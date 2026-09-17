import { describe, expect, it, vi } from 'vitest';
import { deleteStaleRateLimitBlobs, staleRateLimitKeys } from './rateLimitBlobs';

describe('staleRateLimitKeys', () => {
  it('keeps the current minute and drops older rate-limit keys', () => {
    expect(
      staleRateLimitKeys(
        [
          '_rl:GET:abc123def4567890:100',
          '_rl:GET:abc123def4567890:99',
          '_rl:PUT:abc123def4567890:98',
          'ONTABC',
        ],
        100
      )
    ).toEqual([
      '_rl:GET:abc123def4567890:99',
      '_rl:PUT:abc123def4567890:98',
    ]);
  });
});

describe('deleteStaleRateLimitBlobs', () => {
  it('deletes only listed _rl keys from previous minutes', async () => {
    const store = {
      list: vi.fn().mockResolvedValue({
        blobs: [
          { key: '_rl:GET:abc123def4567890:100', etag: 'a' },
          { key: '_rl:GET:abc123def4567890:99', etag: 'b' },
          { key: 'ONTABC', etag: 'c' },
        ],
      }),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    await deleteStaleRateLimitBlobs(store, 100);

    expect(store.list).toHaveBeenCalledWith({ prefix: '_rl:' });
    expect(store.delete).toHaveBeenCalledTimes(1);
    expect(store.delete).toHaveBeenCalledWith('_rl:GET:abc123def4567890:99');
  });
});
