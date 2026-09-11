import type { PublishedSchedulePayload } from '../types/publishedSchedule';
import { fetchPublishedSchedule } from './scheduleApi';
import { normalizeCode } from './publishCodes';

const TTL_MS = 60_000;
const STORAGE_PREFIX = 'evalmatrix_pub_cache:';

type CacheEntry = { payload: PublishedSchedulePayload; expires: number };

const memory = new Map<string, CacheEntry>();

function readSessionCache(code: string): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + code);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed?.payload || typeof parsed.expires !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionCache(code: string, entry: CacheEntry): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + code, JSON.stringify(entry));
  } catch {
    // Quota or private-mode — memory cache still works for this tab.
  }
}

function fresh(entry: CacheEntry | null | undefined): CacheEntry | null {
  if (!entry || entry.expires <= Date.now()) return null;
  return entry;
}

export function invalidatePublishedScheduleCache(code?: string): void {
  if (code) {
    const key = normalizeCode(code);
    memory.delete(key);
    try {
      sessionStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
      /* ignore */
    }
    return;
  }
  memory.clear();
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) toRemove.push(key);
    }
    toRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

export async function fetchPublishedScheduleCached(
  code: string,
  signal?: AbortSignal
): Promise<PublishedSchedulePayload> {
  const key = normalizeCode(code);
  const cached = fresh(memory.get(key)) ?? fresh(readSessionCache(key));
  if (cached) {
    memory.set(key, cached);
    return cached.payload;
  }

  const payload = await fetchPublishedSchedule(key, signal);
  const entry = { payload, expires: Date.now() + TTL_MS };
  memory.set(key, entry);
  writeSessionCache(key, entry);
  return payload;
}
