export type UnscheduleDropPayload = {
  entrantId: string;
  type: string;
  sessionIndex?: number;
};

export function parseUnscheduleDropPayload(raw: string): UnscheduleDropPayload | null {
  if (!raw) return null;
  try {
    const dragged = JSON.parse(raw) as {
      isRemoving?: boolean;
      entrantId?: string;
      type?: string;
      sessionIndex?: number;
    };
    if (!dragged?.isRemoving || !dragged.entrantId || !dragged.type) return null;
    return {
      entrantId: dragged.entrantId,
      type: dragged.type,
      sessionIndex: dragged.sessionIndex,
    };
  } catch {
    return null;
  }
}
