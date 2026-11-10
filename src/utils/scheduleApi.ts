import type { PublishedSchedulePayload } from '../types/publishedSchedule';
import { normalizeCode, isValidNormalizedCode } from './publishCodes';
import { parsePublishedSchedulePayload, PayloadValidationError } from './publishedScheduleSchema';

const DEFAULT_TIMEOUT_MS = 15_000;

export class ScheduleApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  window.setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function mergeSignals(user?: AbortSignal, timeoutMs = DEFAULT_TIMEOUT_MS): AbortSignal {
  const timeout = timeoutSignal(timeoutMs);
  if (!user) return timeout;
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
    return AbortSignal.any([user, timeout]);
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (user.aborted || timeout.aborted) {
    abort();
    return controller.signal;
  }
  user.addEventListener('abort', abort, { once: true });
  timeout.addEventListener('abort', abort, { once: true });
  return controller.signal;
}

function messageForStatus(status: number, fallback: string): string {
  switch (status) {
    case 400:
      return 'Invalid schedule request';
    case 403:
      return 'Edit token rejected';
    case 404:
      return 'Not found or expired';
    case 409:
      return 'Code already taken';
    case 413:
      return 'Schedule is too large to publish';
    case 422:
      return 'This schedule is damaged or from a newer app version.';
    case 429:
      return 'Too many requests. Wait a moment and try again.';
    default:
      return fallback;
  }
}

export function userMessageForApiError(err: unknown, fallback: string): string {
  if (err instanceof PayloadValidationError) {
    return 'This schedule is damaged or from a newer app version.';
  }
  if (err instanceof ScheduleApiError) {
    return messageForStatus(err.status, fallback);
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'Request timed out. Check your connection and try again.';
  }
  if (err instanceof Error && err.message) {
    return fallback;
  }
  return fallback;
}

export async function fetchPublishedSchedule(
  code: string,
  signal?: AbortSignal
): Promise<PublishedSchedulePayload> {
  const normalized = normalizeCode(code);
  if (!isValidNormalizedCode(normalized)) {
    throw new ScheduleApiError(400, 'Invalid code');
  }
  let res: Response;
  try {
    res = await fetch(`/api/schedules/${normalized}`, { signal: mergeSignals(signal) });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new ScheduleApiError(0, 'Fetch failed');
  }
  if (!res.ok) {
    throw new ScheduleApiError(res.status, messageForStatus(res.status, 'Fetch failed'));
  }
  const data: unknown = await res.json();
  const payload = isRecord(data) ? data.payload : undefined;
  try {
    return parsePublishedSchedulePayload(payload);
  } catch (err) {
    if (err instanceof PayloadValidationError) throw err;
    throw new PayloadValidationError('Invalid schedule payload');
  }
}

export type PublishResult = {
  updatedAt?: string;
  /** Older servers don't return this. */
  expiresAt?: string;
};

export async function putPublishedSchedule(
  code: string,
  editToken: string,
  payload: PublishedSchedulePayload,
  signal?: AbortSignal
): Promise<PublishResult> {
  const normalized = normalizeCode(code);
  let res: Response;
  try {
    res = await fetch(`/api/schedules/${normalized}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editToken, payload }),
      signal: mergeSignals(signal),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new ScheduleApiError(0, 'Publish failed');
  }
  if (!res.ok) {
    throw new ScheduleApiError(res.status, messageForStatus(res.status, 'Publish failed'));
  }
  const data: unknown = await res.json().catch(() => null);
  return {
    updatedAt: isRecord(data) && typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    expiresAt: isRecord(data) && typeof data.expiresAt === 'string' ? data.expiresAt : undefined,
  };
}

export type PublishStatus =
  | { state: 'live'; updatedAt: string; expiresAt: string; sessionCount: number }
  /** Expired, but this token can still restore the code by publishing. */
  | { state: 'expired' }
  /** No live schedule at this code for this token. */
  | { state: 'not-found' }
  | { state: 'forbidden' };

/** Checks whether `editToken` owns `code` without changing anything on the server. */
export async function checkPublishStatus(
  code: string,
  editToken: string,
  signal?: AbortSignal
): Promise<PublishStatus> {
  const normalized = normalizeCode(code);
  if (!isValidNormalizedCode(normalized)) {
    throw new ScheduleApiError(400, 'Invalid code');
  }
  let res: Response;
  try {
    res = await fetch(`/api/schedules/${normalized}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editToken }),
      signal: mergeSignals(signal),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new ScheduleApiError(0, 'Status check failed');
  }
  const data: unknown = await res.json().catch(() => null);
  if (res.status === 403) return { state: 'forbidden' };
  if (res.status === 404) {
    return isRecord(data) && data.expired === true ? { state: 'expired' } : { state: 'not-found' };
  }
  if (!res.ok || !isRecord(data)) {
    throw new ScheduleApiError(res.status, messageForStatus(res.status, 'Status check failed'));
  }
  return {
    state: 'live',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : '',
    sessionCount: typeof data.sessionCount === 'number' ? data.sessionCount : 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
