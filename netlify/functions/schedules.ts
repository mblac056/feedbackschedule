import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { parsePublishedSchedulePayload, PayloadValidationError } from '../../src/utils/publishedScheduleSchema';
import { deleteStaleRateLimitBlobs } from '../../src/utils/rateLimitBlobs';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Published schedules live this long after their last publish. */
const TTL_MS = 90 * DAY_MS;
/** After expiry, only the original edit token can reclaim the code for this long. */
const TOMBSTONE_MS = 365 * DAY_MS;
const CODE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MAX_BODY_CHARS = 512_000;
const GET_RATE_LIMIT = 60;
const PUT_RATE_LIMIT = 15;
const RATE_WINDOW_MS = 60_000;
const ALLOWED_ORIGINS = new Set([
  'https://feedbackschedule.com',
  'https://www.feedbackschedule.com',
]);

type BlobRecord = {
  /** null once expired: the record is kept as a tombstone that holds the token hash. */
  payload: unknown;
  editTokenHash: string;
  updatedAt: string;
  expiresAt: string;
};

function normalizeCode(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function isValidCode(code: string): boolean {
  return code.length === 6 && [...code].every((ch) => CODE_CHARSET.includes(ch));
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function tokensEqual(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, 'hex');
    const b = Buffer.from(bHex, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (origin.endsWith('.netlify.app') && origin.startsWith('https://')) return true;
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true;
  return false;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowOrigin = isAllowedOrigin(origin) ? origin : 'https://feedbackschedule.com';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    Vary: 'Origin',
  };
}

function noCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
  };
}

function json(req: Request, status: number, body: unknown, extra?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...noCacheHeaders(),
      ...corsHeaders(req),
      ...(extra ?? {}),
    },
  });
}

function clientIp(req: Request): string {
  return (
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

async function enforceRateLimit(
  req: Request,
  store: ReturnType<typeof getStore>,
  kind: 'GET' | 'PUT'
): Promise<Response | null> {
  // POST (status check) shares the PUT budget.
  const limit = kind === 'GET' ? GET_RATE_LIMIT : PUT_RATE_LIMIT;
  const bucket = Math.floor(Date.now() / RATE_WINDOW_MS);
  const ipHash = hashToken(clientIp(req)).slice(0, 16);
  const key = `_rl:${kind}:${ipHash}:${bucket}`;
  const current = (await store.get(key, { type: 'json' })) as { n?: number } | null;
  const n = (current?.n ?? 0) + 1;
  if (n > limit) {
    return json(req, 429, { error: 'Too many requests' }, { 'Retry-After': '60' });
  }
  await store.setJSON(key, { n });
  return null;
}

/** Expiry time in ms, or NaN when the record has no usable timestamps. */
function expiresAtMs(record: BlobRecord): number {
  const expiresAt = Date.parse(record.expiresAt);
  if (Number.isFinite(expiresAt)) return expiresAt;
  const updatedAt = Date.parse(record.updatedAt);
  if (Number.isFinite(updatedAt)) return updatedAt + TTL_MS;
  return Number.NaN;
}

function isExpired(record: BlobRecord): boolean {
  if (record.payload === null) return true;
  const expiresAt = expiresAtMs(record);
  if (!Number.isFinite(expiresAt)) return true;
  return Date.now() > expiresAt;
}

/** Expired, but still inside the window where only the original token may reclaim the code. */
function isTombstoneActive(record: BlobRecord): boolean {
  if (!isExpired(record)) return false;
  const expiresAt = expiresAtMs(record);
  if (!Number.isFinite(expiresAt)) return false;
  return Date.now() <= expiresAt + TOMBSTONE_MS;
}

async function readJsonBody(req: Request): Promise<Record<string, unknown> | Response> {
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return json(req, 400, { error: 'Invalid body' });
  }
  if (rawBody.length > MAX_BODY_CHARS) {
    return json(req, 400, { error: 'Request body too large' });
  }
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return json(req, 400, { error: 'Invalid JSON' });
    }
    return parsed as Record<string, unknown>;
  } catch {
    return json(req, 400, { error: 'Invalid JSON' });
  }
}

function sessionCountOf(payload: unknown): number {
  if (typeof payload !== 'object' || payload === null) return 0;
  const sessions = (payload as { sessions?: unknown }).sessions;
  return Array.isArray(sessions) ? sessions.length : 0;
}

export default async (req: Request, context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: { ...noCacheHeaders(), ...corsHeaders(req) } });
  }

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const code = normalizeCode(url.searchParams.get('code') || parts[parts.length - 1] || '');
  if (!isValidCode(code)) {
    return json(req, 400, { error: 'Invalid code' });
  }

  const store = getStore('published-schedules');
  const rateLimitBucket = Math.floor(Date.now() / RATE_WINDOW_MS);
  context.waitUntil(
    deleteStaleRateLimitBlobs(store, rateLimitBucket).catch((error) => {
      console.error('Rate limit blob cleanup failed', error);
    })
  );

  try {
    const limited = await enforceRateLimit(req, store, req.method === 'GET' ? 'GET' : 'PUT');
    if (limited) return limited;
  } catch (error) {
    console.error('Rate limit check failed', error);
  }

  if (req.method === 'GET') {
    const raw = await store.get(code, { type: 'json' });
    if (!raw) return json(req, 404, { error: 'Not found' });
    const record = raw as BlobRecord;
    if (isExpired(record)) {
      if (isTombstoneActive(record)) {
        if (record.payload !== null) {
          // Drop the schedule but keep the token hash so the code can't be taken over.
          const tombstone: BlobRecord = { ...record, payload: null, expiresAt: new Date(expiresAtMs(record)).toISOString() };
          await store.setJSON(code, tombstone);
        }
      } else {
        await store.delete(code);
      }
      return json(req, 404, { error: 'Expired' });
    }
    try {
      parsePublishedSchedulePayload(record.payload);
    } catch {
      return json(req, 422, { error: 'Stored payload is invalid' });
    }
    return json(req, 200, { payload: record.payload, updatedAt: record.updatedAt });
  }

  if (req.method === 'POST') {
    // Status check: confirms the token owns the code without changing anything.
    const body = await readJsonBody(req);
    if (body instanceof Response) return body;
    if (typeof body.editToken !== 'string' || body.editToken === '') {
      return json(req, 400, { error: 'editToken required' });
    }
    const existing = (await store.get(code, { type: 'json', consistency: 'strong' })) as BlobRecord | null;
    if (!existing) return json(req, 404, { error: 'Not found' });
    const tokenMatches = tokensEqual(existing.editTokenHash, hashToken(body.editToken));
    if (isExpired(existing)) {
      if (tokenMatches && isTombstoneActive(existing)) {
        return json(req, 404, { error: 'Expired', expired: true });
      }
      return json(req, 404, { error: 'Not found' });
    }
    if (!tokenMatches) return json(req, 403, { error: 'Forbidden' });
    return json(req, 200, {
      updatedAt: existing.updatedAt,
      expiresAt: new Date(expiresAtMs(existing)).toISOString(),
      sessionCount: sessionCountOf(existing.payload),
    });
  }

  if (req.method === 'PUT') {
    const body = await readJsonBody(req);
    if (body instanceof Response) return body;
    if (!body.editToken || typeof body.editToken !== 'string' || body.payload === undefined) {
      return json(req, 400, { error: 'editToken and payload required' });
    }

    let payload;
    try {
      payload = parsePublishedSchedulePayload(body.payload);
    } catch (error) {
      const message = error instanceof PayloadValidationError ? error.message : 'Invalid payload';
      return json(req, 400, { error: message });
    }

    const existing = (await store.get(code, { type: 'json', consistency: 'strong' })) as BlobRecord | null;
    const incomingHash = hashToken(body.editToken);
    // Live records and active tombstones both belong to the original token.
    const owned = Boolean(existing && (!isExpired(existing) || isTombstoneActive(existing)));

    if (existing && owned) {
      if (!tokensEqual(existing.editTokenHash, incomingHash)) {
        return json(req, 403, { error: 'Forbidden' });
      }
    } else if (existing) {
      // Past the reclaim window: the code is free for a new owner.
      await store.delete(code);
    }

    const now = new Date();
    const record: BlobRecord = {
      payload,
      editTokenHash: existing && owned ? existing.editTokenHash : incomingHash,
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + TTL_MS).toISOString(),
    };

    const creating = !existing || !owned;
    try {
      if (creating) {
        // setJSON() in @netlify/blobs 10.7.x spreads conditions instead of passing
        // them as `conditions`, so onlyIfNew is ignored there. Use set().
        const { modified } = await store.set(code, JSON.stringify(record), { onlyIfNew: true });
        if (!modified) {
          return json(req, 409, { error: 'Code already taken' });
        }
      } else {
        await store.setJSON(code, record);
      }
    } catch (error) {
      console.error('Publish write failed', error);
      return json(req, 500, { error: 'Publish failed' });
    }

    return json(req, 200, { ok: true, updatedAt: record.updatedAt, expiresAt: record.expiresAt });
  }

  return json(req, 405, { error: 'Method not allowed' });
};
