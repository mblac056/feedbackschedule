import type { PublishedSchedulePayload } from '../types/publishedSchedule';
import { normalizeCode, isValidNormalizedCode } from './publishCodes';

export class ScheduleApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function fetchPublishedSchedule(code: string): Promise<PublishedSchedulePayload> {
  const normalized = normalizeCode(code);
  if (!isValidNormalizedCode(normalized)) {
    throw new ScheduleApiError(400, 'Invalid code');
  }
  const res = await fetch(`/api/schedules/${normalized}`);
  if (!res.ok) {
    throw new ScheduleApiError(res.status, res.status === 404 ? 'Not found or expired' : 'Fetch failed');
  }
  const data = (await res.json()) as { payload: PublishedSchedulePayload };
  return data.payload;
}

export async function putPublishedSchedule(
  code: string,
  editToken: string,
  payload: PublishedSchedulePayload
): Promise<void> {
  const normalized = normalizeCode(code);
  const res = await fetch(`/api/schedules/${normalized}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ editToken, payload }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ScheduleApiError(res.status, text || 'Publish failed');
  }
}
