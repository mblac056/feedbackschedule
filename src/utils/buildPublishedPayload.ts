import type { Judge, Entrant, SessionBlock } from '../types';
import type { SessionSettings } from '../config/timeConfig';
import type { PublishedSchedulePayload } from '../types/publishedSchedule';
import { buildSlugMap } from './personSlugs';

export function buildPublishedPayload(args: {
  judges: Judge[];
  entrants: Entrant[];
  sessionBlocks: SessionBlock[];
  settings: SessionSettings;
}): PublishedSchedulePayload {
  const activeJudges = args.judges.filter((j) => j.active !== false);
  const scheduled = args.sessionBlocks.filter(
    (s) =>
      s.isScheduled &&
      s.judgeId &&
      s.startRowIndex !== undefined &&
      s.endRowIndex !== undefined
  );

  const judgeIds = new Set(scheduled.map((s) => s.judgeId!));
  const entrantIds = new Set(scheduled.map((s) => s.entrantId));

  const judges = activeJudges
    .filter((j) => judgeIds.has(j.id))
    .map((j) => ({
      id: j.id,
      name: j.name,
      category: j.category,
      roomNumber: j.roomNumber,
    }));

  const entrants = args.entrants
    .filter((e) => entrantIds.has(e.id))
    .map((e) => ({
      id: e.id,
      name: e.name,
      groupType: e.groupType,
      roomNumber: e.roomNumber,
    }));

  const slugs = buildSlugMap([
    ...judges.map((j) => ({ id: j.id, name: j.name })),
    ...entrants.map((e) => ({ id: e.id, name: e.name })),
  ]);

  const slugIndex: PublishedSchedulePayload['slugIndex'] = {};
  for (const j of judges) {
    slugIndex[slugs[j.id]] = { kind: 'judge', id: j.id };
  }
  for (const e of entrants) {
    slugIndex[slugs[e.id]] = { kind: 'entrant', id: e.id };
  }

  return {
    version: 1,
    exportName: args.settings.exportName?.trim() || undefined,
    settings: {
      startTime: args.settings.startTime,
      oneXLongLength: args.settings.oneXLongLength,
      threeX20Length: args.settings.threeX20Length,
      threeX10Length: args.settings.threeX10Length,
      moving: args.settings.moving,
    },
    judges,
    entrants,
    sessions: scheduled.map((s) => ({
      id: s.id,
      entrantId: s.entrantId,
      entrantName: s.entrantName,
      type: s.type,
      sessionIndex: s.sessionIndex,
      startRowIndex: s.startRowIndex!,
      endRowIndex: s.endRowIndex!,
      judgeId: s.judgeId!,
    })),
    slugs,
    slugIndex,
  };
}
