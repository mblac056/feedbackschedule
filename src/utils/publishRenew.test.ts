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

const api = vi.hoisted(() => ({
  fetchPublishedSchedule: vi.fn(),
  putPublishedSchedule: vi.fn(),
}));

vi.mock('./scheduleApi', async (orig) => ({ ...(await orig<typeof import('./scheduleApi')>()), ...api }));

const { renewPublishedSchedule } = await import('./publishRenew');
const { getPublishCredentials, setPublishCredentials } = await import('./publishStorage');
const { fingerprintPayload } = await import('./publishFingerprint');
const { ScheduleApiError } = await import('./scheduleApi');

describe('renewPublishedSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPublishCredentials('ABC234', 'tok', {
      updatedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-04-01T00:00:00.000Z',
      fingerprint: 'local-edits',
      publishedSessionCount: 3,
    });
  });

  it('republishes the live payload unchanged and stores the new expiry', async () => {
    api.fetchPublishedSchedule.mockResolvedValue(live);
    api.putPublishedSchedule.mockResolvedValue({
      updatedAt: '2026-03-25T00:00:00.000Z',
      expiresAt: '2026-06-23T00:00:00.000Z',
    });

    expect(await renewPublishedSchedule('ABC234', 'tok')).toBe('2026-06-23T00:00:00.000Z');
    expect(api.putPublishedSchedule).toHaveBeenCalledWith('ABC234', 'tok', live);
    expect(getPublishCredentials()).toEqual({
      code: 'ABC234',
      editToken: 'tok',
      updatedAt: '2026-03-25T00:00:00.000Z',
      expiresAt: '2026-06-23T00:00:00.000Z',
      fingerprint: await fingerprintPayload(live),
      publishedSessionCount: 0,
    });
  });

  it('does not publish when the code has expired', async () => {
    api.fetchPublishedSchedule.mockRejectedValue(new ScheduleApiError(404, 'Not found or expired'));
    await expect(renewPublishedSchedule('ABC234', 'tok')).rejects.toMatchObject({ status: 404 });
    expect(api.putPublishedSchedule).not.toHaveBeenCalled();
    expect(getPublishCredentials()?.expiresAt).toBe('2026-04-01T00:00:00.000Z');
  });

  it('leaves stored credentials alone when the token is rejected', async () => {
    api.fetchPublishedSchedule.mockResolvedValue(live);
    api.putPublishedSchedule.mockRejectedValue(new ScheduleApiError(403, 'Edit token rejected'));
    await expect(renewPublishedSchedule('ABC234', 'tok')).rejects.toMatchObject({ status: 403 });
    expect(getPublishCredentials()?.fingerprint).toBe('local-edits');
  });
});
