import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const blobs = new Map<string, string>();

vi.mock('@netlify/blobs', () => ({
  getStore: () => ({
    get: async (key: string) => {
      const raw = blobs.get(key);
      return raw === undefined ? null : JSON.parse(raw);
    },
    set: async (key: string, value: string, opts?: { onlyIfNew?: boolean }) => {
      if (opts?.onlyIfNew && blobs.has(key)) return { modified: false };
      blobs.set(key, value);
      return { modified: true };
    },
    setJSON: async (key: string, value: unknown) => {
      blobs.set(key, JSON.stringify(value));
    },
    delete: async (key: string) => {
      blobs.delete(key);
    },
    list: async () => ({ blobs: [] }),
  }),
}));

const { default: handler } = await import('../../netlify/functions/schedules');

const DAY = 24 * 60 * 60 * 1000;
const CODE = 'ABC234';
const OWNER = 'a'.repeat(48);
const STRANGER = 'b'.repeat(48);
const context = { waitUntil: (p: Promise<unknown>) => p } as never;

const emptyPayload = {
  version: 1,
  exportName: 'Fall Contest',
  settings: { startTime: '09:00', oneXLongLength: 6, threeX20Length: 2, threeX10Length: 1, moving: 'judges' },
  judges: [],
  entrants: [],
  sessions: [],
  slugs: {},
  slugIndex: {},
};

function call(method: string, body?: unknown) {
  return handler(
    new Request(`https://feedbackschedule.com/api/schedules/${CODE}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-nf-client-connection-ip': `ip-${Math.random()}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    context
  );
}

const publish = (editToken: string) => call('PUT', { editToken, payload: emptyPayload });
const status = (editToken: string) => call('POST', { editToken });

describe('schedules function', () => {
  beforeEach(() => {
    blobs.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('accepts an empty schedule and returns a 90-day expiry', async () => {
    const res = await publish(OWNER);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expiresAt).toBe('2026-04-01T00:00:00.000Z');
  });

  it('keeps the schedule live at day 89 and expires it after day 90', async () => {
    await publish(OWNER);
    vi.setSystemTime(Date.now() + 89 * DAY);
    expect((await call('GET')).status).toBe(200);
    vi.setSystemTime(Date.now() + 2 * DAY);
    expect((await call('GET')).status).toBe(404);
  });

  it('extends expiry on republish', async () => {
    await publish(OWNER);
    vi.setSystemTime(Date.now() + 60 * DAY);
    await publish(OWNER);
    vi.setSystemTime(Date.now() + 60 * DAY);
    expect((await call('GET')).status).toBe(200);
  });

  it('reports status to the owner only', async () => {
    await publish(OWNER);
    const ok = await status(OWNER);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ expiresAt: '2026-04-01T00:00:00.000Z', sessionCount: 0 });
    expect((await status(STRANGER)).status).toBe(403);
  });

  it('status check does not extend expiry', async () => {
    await publish(OWNER);
    vi.setSystemTime(Date.now() + 80 * DAY);
    await status(OWNER);
    vi.setSystemTime(Date.now() + 11 * DAY);
    expect((await call('GET')).status).toBe(404);
  });

  it('blocks takeover of an expired code inside the reclaim window', async () => {
    await publish(OWNER);
    vi.setSystemTime(Date.now() + 100 * DAY);
    expect((await call('GET')).status).toBe(404);
    expect(JSON.parse(blobs.get(CODE)!).payload).toBeNull();
    expect((await publish(STRANGER)).status).toBe(403);
    const ownerStatus = await status(OWNER);
    expect(ownerStatus.status).toBe(404);
    expect(await ownerStatus.json()).toMatchObject({ expired: true });
    expect(await (await status(STRANGER)).json()).not.toHaveProperty('expired');
  });

  it('blocks takeover even if nobody viewed the expired code', async () => {
    await publish(OWNER);
    vi.setSystemTime(Date.now() + 100 * DAY);
    expect((await publish(STRANGER)).status).toBe(403);
  });

  it('lets the owner restore an expired code with a fresh 90 days', async () => {
    await publish(OWNER);
    vi.setSystemTime(Date.now() + 100 * DAY);
    await call('GET');
    expect((await publish(OWNER)).status).toBe(200);
    expect((await call('GET')).status).toBe(200);
    expect((await status(OWNER)).status).toBe(200);
  });

  it('frees the code after the reclaim window', async () => {
    await publish(OWNER);
    vi.setSystemTime(Date.now() + (90 + 366) * DAY);
    expect((await publish(STRANGER)).status).toBe(200);
    expect((await status(STRANGER)).status).toBe(200);
    expect((await status(OWNER)).status).toBe(403);
  });

  it('treats legacy records without expiresAt as expiring 90 days after updatedAt', async () => {
    blobs.set(
      CODE,
      JSON.stringify({ payload: emptyPayload, editTokenHash: 'x', updatedAt: '2026-01-01T00:00:00Z', expiresAt: '' })
    );
    vi.setSystemTime(Date.now() + 30 * DAY);
    expect((await call('GET')).status).toBe(200);
  });

  it('returns 404 for status on an unknown code', async () => {
    expect((await status(OWNER)).status).toBe(404);
  });
});
