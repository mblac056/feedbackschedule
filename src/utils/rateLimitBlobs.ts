export const RATE_LIMIT_KEY_PREFIX = '_rl:';

type BlobStore = {
  list: (options: { prefix: string }) => Promise<{ blobs: { key: string }[] }>;
  delete: (key: string) => Promise<unknown>;
};

export function parseRateLimitBucket(key: string): number | null {
  const parts = key.split(':');
  if (parts.length !== 4 || parts[0] !== '_rl') return null;
  const bucket = Number(parts[3]);
  return Number.isInteger(bucket) ? bucket : null;
}

export function staleRateLimitKeys(keys: string[], currentBucket: number): string[] {
  return keys.filter((key) => {
    const bucket = parseRateLimitBucket(key);
    return bucket !== null && bucket < currentBucket;
  });
}

export async function deleteStaleRateLimitBlobs(
  store: BlobStore,
  currentBucket: number
): Promise<void> {
  const { blobs } = await store.list({ prefix: RATE_LIMIT_KEY_PREFIX });
  const stale = staleRateLimitKeys(blobs.map((blob) => blob.key), currentBucket);
  await Promise.all(stale.map((key) => store.delete(key)));
}
