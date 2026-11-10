import type { PublishedSchedulePayload } from '../types/publishedSchedule';
import { parsePublishedSchedulePayload } from './publishedScheduleSchema';

/**
 * SHA-256 of the public payload in a normalized form. Only what attendees see is
 * hashed, so edits to notes or unscheduled blocks don't mark a publish as stale.
 */
export async function fingerprintPayload(payload: PublishedSchedulePayload): Promise<string> {
  // The parser rebuilds the object in a fixed key order and drops undefined fields.
  const normalized = JSON.stringify(parsePublishedSchedulePayload(payload));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
