import { describe, expect, it } from 'vitest';
import { derivePublishState } from './publishStatus';
import type { PublishCredentials } from './publishStorage';

const NOW = Date.parse('2026-03-01T00:00:00Z');
const base: PublishCredentials = {
  code: 'ABC234',
  editToken: 't',
  updatedAt: '2026-02-01T00:00:00.000Z',
  expiresAt: '2026-05-02T00:00:00.000Z',
  fingerprint: 'fp1',
  publishedSessionCount: 4,
};
const live = { state: 'live' as const, updatedAt: base.updatedAt!, expiresAt: base.expiresAt!, sessionCount: 4 };

function state(over: Partial<Parameters<typeof derivePublishState>[0]> = {}) {
  return derivePublishState({
    credentials: base,
    currentFingerprint: 'fp1',
    currentSessionCount: 4,
    server: live,
    now: NOW,
    ...over,
  });
}

describe('derivePublishState', () => {
  it('is up to date when fingerprints match', () => {
    expect(state()).toBe('up-to-date');
  });

  it('is out of date when fingerprints differ', () => {
    expect(state({ currentFingerprint: 'fp2' })).toBe('out-of-date');
  });

  it('is reserved when the matching publish has no sessions', () => {
    expect(state({ currentSessionCount: 0 })).toBe('reserved');
  });

  it('is reserved-pending when a placeholder is live and sessions now exist', () => {
    expect(
      state({ credentials: { ...base, publishedSessionCount: 0 }, currentFingerprint: 'fp2', currentSessionCount: 3 })
    ).toBe('reserved-pending');
  });

  it('is out of date when only the round name changed on a placeholder', () => {
    expect(
      state({ credentials: { ...base, publishedSessionCount: 0 }, currentFingerprint: 'fp2', currentSessionCount: 0 })
    ).toBe('out-of-date');
  });

  it('is expired when the stored expiry has passed and the server is unreachable', () => {
    expect(state({ server: null, now: Date.parse('2026-06-01T00:00:00Z') })).toBe('expired');
  });

  it('is expired when the server says expired or not found', () => {
    expect(state({ server: { state: 'expired' } })).toBe('expired');
    expect(state({ server: { state: 'not-found' } })).toBe('expired');
  });

  it('flags a newer publish from another device', () => {
    expect(state({ server: { ...live, updatedAt: '2026-02-10T00:00:00.000Z' } })).toBe('changed-elsewhere');
  });

  it('reports a rejected token', () => {
    expect(state({ server: { state: 'forbidden' } })).toBe('token-rejected');
  });

  it('is unknown for legacy credentials without a fingerprint', () => {
    expect(state({ credentials: { code: 'ABC234', editToken: 't' }, server: null })).toBe('unknown');
  });

  it('falls back to local data when the server check has not run', () => {
    expect(state({ server: null })).toBe('up-to-date');
  });
});
