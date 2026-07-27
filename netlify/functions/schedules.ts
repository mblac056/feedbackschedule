import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type BlobRecord = {
  payload: unknown;
  editTokenHash: string;
  updatedAt: string;
};

function normalizeCode(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function isValidCode(code: string): boolean {
  return code.length === 6 && [...code].every((ch) => CODE_ALPHABET.includes(ch));
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

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
  };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders() });
  }

  const url = new URL(req.url);
  // Expected path after redirect: /api/schedules/:code or function path with code segment
  const parts = url.pathname.split('/').filter(Boolean);
  const code = normalizeCode(url.searchParams.get('code') || parts[parts.length - 1] || '');
  if (!isValidCode(code)) {
    return json(400, { error: 'Invalid code' });
  }

  const store = getStore('published-schedules');

  if (req.method === 'GET') {
    const raw = await store.get(code, { type: 'json' });
    if (!raw) return json(404, { error: 'Not found' });
    const record = raw as BlobRecord;
    if (Date.now() - Date.parse(record.updatedAt) > TTL_MS) {
      await store.delete(code);
      return json(404, { error: 'Expired' });
    }
    return json(200, { payload: record.payload, updatedAt: record.updatedAt });
  }

  if (req.method === 'PUT') {
    let body: { editToken?: string; payload?: unknown };
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'Invalid JSON' });
    }
    if (!body.editToken || typeof body.editToken !== 'string' || body.payload === undefined) {
      return json(400, { error: 'editToken and payload required' });
    }

    const existing = (await store.get(code, { type: 'json' })) as BlobRecord | null;
    const incomingHash = hashToken(body.editToken);

    if (existing) {
      if (!tokensEqual(existing.editTokenHash, incomingHash)) {
        return json(403, { error: 'Forbidden' });
      }
    }

    const record: BlobRecord = {
      payload: body.payload,
      editTokenHash: existing?.editTokenHash ?? incomingHash,
      updatedAt: new Date().toISOString(),
    };
    await store.setJSON(code, record);
    return json(200, { ok: true, updatedAt: record.updatedAt });
  }

  return json(405, { error: 'Method not allowed' });
};
