import { describe, expect, it } from 'vitest';
import { parsePublishCredentials } from './publishStorage';

describe('parsePublishCredentials', () => {
  it('accepts legacy code + token only', () => {
    expect(parsePublishCredentials({ code: 'ABC234', editToken: 't' })).toEqual({ code: 'ABC234', editToken: 't' });
  });

  it('keeps valid status fields and drops bad ones', () => {
    expect(
      parsePublishCredentials({
        code: 'ABC234',
        editToken: 't',
        updatedAt: '2026-01-01T00:00:00Z',
        expiresAt: 42,
        fingerprint: 'fp',
        publishedSessionCount: -1,
      })
    ).toEqual({ code: 'ABC234', editToken: 't', updatedAt: '2026-01-01T00:00:00Z', fingerprint: 'fp' });
  });

  it('rejects missing or blank code/token', () => {
    expect(parsePublishCredentials({ code: '', editToken: 't' })).toBeNull();
    expect(parsePublishCredentials({ code: 'ABC234' })).toBeNull();
    expect(parsePublishCredentials(null)).toBeNull();
  });
});
