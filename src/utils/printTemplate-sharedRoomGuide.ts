import type { Entrant, SessionBlock } from '../types';
import type { SessionSettings } from '../config/timeConfig';
import { getSettings } from './localStorage';
import { doTimeRangesOverlap, getSessionDurationInSlots } from './scheduleHelpers';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface SharedRoomGuideRow {
  entrantId: string;
  name: string;
  performers: string;
  canShareWith: string[];
}

export interface SharedRoomGuideData {
  rows: SharedRoomGuideRow[];
  minimumRooms: number;
}

function getSessionRange(
  session: SessionBlock,
  settings: SessionSettings
): { start: number; end: number } | null {
  if (session.startRowIndex === undefined) return null;
  const duration = getSessionDurationInSlots(session.type, settings);
  return {
    start: session.startRowIndex,
    end: session.startRowIndex + duration - 1,
  };
}

function getOverallSpan(
  sessions: SessionBlock[],
  settings: SessionSettings
): { start: number; end: number } | null {
  let start: number | null = null;
  let end: number | null = null;

  for (const session of sessions) {
    const range = getSessionRange(session, settings);
    if (!range) continue;
    if (start === null || range.start < start) start = range.start;
    if (end === null || range.end > end) end = range.end;
  }

  if (start === null || end === null) return null;
  return { start, end };
}

type SessionOverlapKind = 'hard' | 'soft3x10' | null;

/** Classify session overlaps (no transition padding). Soft = both sessions are 3x10. */
function classifySessionOverlap(
  sessionsA: SessionBlock[],
  sessionsB: SessionBlock[],
  settings: SessionSettings
): SessionOverlapKind {
  let hasSoft = false;

  for (const sessionA of sessionsA) {
    const rangeA = getSessionRange(sessionA, settings);
    if (!rangeA) continue;

    for (const sessionB of sessionsB) {
      const rangeB = getSessionRange(sessionB, settings);
      if (!rangeB) continue;

      if (!doTimeRangesOverlap(rangeA.start, rangeA.end, rangeB.start, rangeB.end)) {
        continue;
      }

      if (sessionA.type === '3x10' && sessionB.type === '3x10') {
        hasSoft = true;
      } else {
        return 'hard';
      }
    }
  }

  return hasSoft ? 'soft3x10' : null;
}

/**
 * Groups cannot share when:
 * - they have a hard session overlap, or
 * - their overall windows (first session start → last session end) overlap,
 *   even if individual sessions do not (would require mid-schedule room swaps).
 * Soft 3x10-only session overlaps still allow sharing.
 */
function cannotShareRoom(
  sessionsA: SessionBlock[],
  sessionsB: SessionBlock[],
  settings: SessionSettings
): boolean {
  const sessionOverlap = classifySessionOverlap(sessionsA, sessionsB, settings);
  if (sessionOverlap === 'hard') return true;
  if (sessionOverlap === 'soft3x10') return false;

  const spanA = getOverallSpan(sessionsA, settings);
  const spanB = getOverallSpan(sessionsB, settings);
  if (!spanA || !spanB) return false;

  return doTimeRangesOverlap(spanA.start, spanA.end, spanB.start, spanB.end);
}

/**
 * Minimum rooms for a fixed room-per-group assignment under share blockers
 * (hard session overlap or overlapping overall windows).
 * Welsh-Powell greedy coloring (optimal or near-optimal for typical contest sizes).
 */
function calculateMinimumRooms(neighbors: Map<string, Set<string>>, ids: string[]): number {
  if (ids.length === 0) return 0;

  const ordered = [...ids].sort((a, b) => {
    const degreeDiff = (neighbors.get(b)?.size ?? 0) - (neighbors.get(a)?.size ?? 0);
    if (degreeDiff !== 0) return degreeDiff;
    return a.localeCompare(b);
  });

  const colorById = new Map<string, number>();
  let maxColor = -1;

  for (const id of ordered) {
    const used = new Set<number>();
    for (const neighborId of neighbors.get(id) ?? []) {
      const neighborColor = colorById.get(neighborId);
      if (neighborColor !== undefined) {
        used.add(neighborColor);
      }
    }

    let color = 0;
    while (used.has(color)) {
      color += 1;
    }
    colorById.set(id, color);
    maxColor = Math.max(maxColor, color);
  }

  return maxColor + 1;
}

export function buildSharedRoomGuideData(
  scheduledSessions: SessionBlock[],
  entrants: Entrant[],
  settings: SessionSettings
): SharedRoomGuideData {
  const scheduledByEntrant = new Map<string, SessionBlock[]>();
  for (const session of scheduledSessions) {
    if (session.isScheduled === false || session.startRowIndex === undefined) continue;
    const list = scheduledByEntrant.get(session.entrantId) ?? [];
    list.push(session);
    scheduledByEntrant.set(session.entrantId, list);
  }

  const eligibleEntrants = entrants
    .filter(e => e.includeInSchedule && scheduledByEntrant.has(e.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const shareBlockers = new Map<string, Set<string>>();
  for (const entrant of eligibleEntrants) {
    shareBlockers.set(entrant.id, new Set());
  }

  for (let i = 0; i < eligibleEntrants.length; i++) {
    for (let j = i + 1; j < eligibleEntrants.length; j++) {
      const a = eligibleEntrants[i];
      const b = eligibleEntrants[j];
      const blocked = cannotShareRoom(
        scheduledByEntrant.get(a.id) ?? [],
        scheduledByEntrant.get(b.id) ?? [],
        settings
      );
      if (!blocked) continue;
      shareBlockers.get(a.id)!.add(b.id);
      shareBlockers.get(b.id)!.add(a.id);
    }
  }

  const rows: SharedRoomGuideRow[] = eligibleEntrants.map(entrant => {
    const blocked = shareBlockers.get(entrant.id) ?? new Set();
    const canShareWith = eligibleEntrants
      .filter(other => other.id !== entrant.id && !blocked.has(other.id))
      .map(other => other.name);

    const performers =
      entrant.pos !== undefined && entrant.pos !== null && String(entrant.pos).trim() !== ''
        ? String(entrant.pos)
        : '—';

    return {
      entrantId: entrant.id,
      name: entrant.name,
      performers,
      canShareWith,
    };
  });

  return {
    rows,
    minimumRooms: calculateMinimumRooms(
      shareBlockers,
      eligibleEntrants.map(e => e.id)
    ),
  };
}

export function generateSharedRoomGuidePage(
  doc: jsPDF,
  data: SharedRoomGuideData
): void {
  const settings = getSettings();
  const feedbackRound = settings.exportName?.trim();
  const { rows, minimumRooms } = data;

  const title = feedbackRound
    ? `Shared Room Guide - ${feedbackRound}`
    : 'Shared Room Guide';

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, 20);

  let yPos = 32;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Minimum number of rooms: ${minimumRooms}`, 20, yPos);

  yPos += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  const subtitle =
    'Groups that can share a room without mid-schedule swaps: no hard overlapping sessions, and overall windows (first session start through last session end) do not overlap. Soft 3x10 overlaps and transition gaps are not treated as blockers here.';
  const subtitleLines = doc.splitTextToSize(
    subtitle,
    doc.internal.pageSize.getWidth() - 40
  ) as string[];
  doc.text(subtitleLines, 20, yPos);
  yPos += subtitleLines.length * 4.5 + 6;
  doc.setTextColor(0, 0, 0);

  const tableData =
    rows.length > 0
      ? rows.map(row => [
          row.name,
          row.performers,
          row.canShareWith.length > 0 ? row.canShareWith.join(', ') : '—',
        ])
      : [['No scheduled groups to display.', '', '']];

  autoTable(doc, {
    head: [['Group', 'Performers', 'Can share room with']],
    body: tableData,
    startY: yPos,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
      valign: 'top',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'bold' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 'auto' },
    },
    margin: { top: 20, left: 20, right: 20, bottom: 20 },
  });
}
