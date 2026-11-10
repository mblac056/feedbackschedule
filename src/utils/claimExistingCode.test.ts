import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublishedSchedulePayload } from '../types/publishedSchedule';

const live: PublishedSchedulePayload = {
  version: 1,
  exportName: 'Fall Contest',
  settings: { startTime: '09:00', oneXLongLength: 6, threeX20Length: 2, threeX10Length: 1, moving: 'judges' },
  judges: [],
  entrants: [],
  sessions: [],
  slugs: {},
  slugIndex: {},
};

const api = vi.hoisted(() => ({ checkPublishStatus: vi.fn(), fetchPublishedSchedule: vi.fn() }));
vi.mock('./scheduleApi', async (orig) => ({ ...(await orig<typeof import('./scheduleApi')>()), ...api }));

const { claimExistingCode } = await import('./claimExistingCode');
const { clearPublishCredentials, getPublishCredentials } = await import('./publishStorage');
const { fingerprintPayload } = await import('./publishFingerprint');

describe('claimExistingCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPublishCredentials();
    api.fetchPublishedSchedule.mockResolvedValue(live);
  });

  it('saves matching credentials with the live status and fingerprint', async () => {
    api.checkPublishStatus.mockResolvedValue({
      state: 'live',
      updatedAt: '2026-11-01T00:00:00.000Z',
      expiresAt: '2027-01-30T00:00:00.000Z',
      sessionCount: 0,
    });
    expect(await claimExistingCode('abc-234', '  tok \n')).toEqual({ outcome: 'saved', code: 'ABC234' });
    expect(api.checkPublishStatus).toHaveBeenCalledWith('ABC234', 'tok');
    expect(getPublishCredentials()).toEqual({
      code: 'ABC234',
      editToken: 'tok',
      updatedAt: '2026-11-01T00:00:00.000Z',
      expiresAt: '2027-01-30T00:00:00.000Z',
      fingerprint: await fingerprintPayload(live),
      publishedSessionCount: 0,
    });
  });

  it('does not save a wrong token or unknown code', async () => {
    api.checkPublishStatus.mockResolvedValue({ state: 'forbidden' });
    expect(await claimExistingCode('ABC234', 'nope')).toEqual({ outcome: 'wrong-token' });
    api.checkPublishStatus.mockResolvedValue({ state: 'not-found' });
    expect(await claimExistingCode('ABC234', 'tok')).toEqual({ outcome: 'not-found' });
    expect(getPublishCredentials()).toBeNull();
  });

  it('saves an expired code the token still owns', async () => {
    api.checkPublishStatus.mockResolvedValue({ state: 'expired' });
    expect(await claimExistingCode('ABC234', 'tok')).toEqual({ outcome: 'saved-expired', code: 'ABC234' });
    expect(getPublishCredentials()).toEqual({ code: 'ABC234', editToken: 'tok' });
  });

  it('rejects bad input without calling the server', async () => {
    expect(await claimExistingCode('AB', 'tok')).toEqual({ outcome: 'invalid-code' });
    expect(await claimExistingCode('ABC234', '   ')).toEqual({ outcome: 'missing-token' });
    expect(api.checkPublishStatus).not.toHaveBeenCalled();
  });
});
