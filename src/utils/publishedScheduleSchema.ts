import type { PublishedSchedulePayload } from '../types/publishedSchedule';

const SESSION_TYPES = new Set(['1xLong', '3x20', '3x10']);
const MOVING = new Set(['judges', 'groups']);
const GROUP_TYPES = new Set(['Chorus', 'Quartet']);
const CATEGORIES = new Set(['SNG', 'MUS', 'PER']);

export class PayloadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayloadValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PayloadValidationError(`${field} must be a non-empty string`);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new PayloadValidationError(`${field} must be a string`);
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new PayloadValidationError(`${field} must be a finite number`);
  }
  return value;
}

function optionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return requireNumber(value, field);
}

/**
 * Strict parse of a published schedule blob. Rejects unknown major versions and
 * missing required collections so public viewers fail with a clear error instead
 * of crashing mid-render on undefined `slugIndex` / `sessions`.
 */
export function parsePublishedSchedulePayload(input: unknown): PublishedSchedulePayload {
  if (!isRecord(input)) {
    throw new PayloadValidationError('payload must be a plain object');
  }
  if (input.version !== 1) {
    throw new PayloadValidationError(
      typeof input.version === 'number'
        ? `Unsupported schedule version ${input.version}`
        : 'payload.version must be 1'
    );
  }
  if (!isRecord(input.settings)) {
    throw new PayloadValidationError('payload.settings must be an object');
  }
  const moving = input.settings.moving;
  if (typeof moving !== 'string' || !MOVING.has(moving)) {
    throw new PayloadValidationError('payload.settings.moving must be "judges" or "groups"');
  }

  const settings: PublishedSchedulePayload['settings'] = {
    startTime: requireString(input.settings.startTime, 'settings.startTime'),
    oneXLongLength: requireNumber(input.settings.oneXLongLength, 'settings.oneXLongLength'),
    threeX20Length: requireNumber(input.settings.threeX20Length, 'settings.threeX20Length'),
    threeX10Length: requireNumber(input.settings.threeX10Length, 'settings.threeX10Length'),
    moving: moving as 'judges' | 'groups',
  };

  if (!Array.isArray(input.judges) || !Array.isArray(input.entrants) || !Array.isArray(input.sessions)) {
    throw new PayloadValidationError('payload.judges, entrants, and sessions must be arrays');
  }
  if (!isRecord(input.slugs) || !isRecord(input.slugIndex)) {
    throw new PayloadValidationError('payload.slugs and slugIndex must be objects');
  }

  const judges = input.judges.map((judge, index) => {
    if (!isRecord(judge)) throw new PayloadValidationError(`judges[${index}] must be an object`);
    const category = optionalString(judge.category, `judges[${index}].category`);
    if (category && !CATEGORIES.has(category)) {
      throw new PayloadValidationError(`judges[${index}].category is invalid`);
    }
    return {
      id: requireString(judge.id, `judges[${index}].id`),
      name: requireString(judge.name, `judges[${index}].name`),
      category: category as PublishedSchedulePayload['judges'][number]['category'],
      roomNumber: optionalString(judge.roomNumber, `judges[${index}].roomNumber`),
    };
  });

  const entrants = input.entrants.map((entrant, index) => {
    if (!isRecord(entrant)) throw new PayloadValidationError(`entrants[${index}] must be an object`);
    const groupType = entrant.groupType;
    if (groupType !== undefined && groupType !== null && (typeof groupType !== 'string' || !GROUP_TYPES.has(groupType))) {
      throw new PayloadValidationError(`entrants[${index}].groupType is invalid`);
    }
    return {
      id: requireString(entrant.id, `entrants[${index}].id`),
      name: requireString(entrant.name, `entrants[${index}].name`),
      groupType: (groupType ?? null) as 'Chorus' | 'Quartet' | null,
      roomNumber: optionalString(entrant.roomNumber, `entrants[${index}].roomNumber`),
      overallSF: optionalNumber(entrant.overallSF, `entrants[${index}].overallSF`),
      overallF: optionalNumber(entrant.overallF, `entrants[${index}].overallF`),
      judgePreference1: optionalString(entrant.judgePreference1, `entrants[${index}].judgePreference1`),
    };
  });

  const sessions = input.sessions.map((session, index) => {
    if (!isRecord(session)) throw new PayloadValidationError(`sessions[${index}] must be an object`);
    const type = session.type;
    if (typeof type !== 'string' || !SESSION_TYPES.has(type)) {
      throw new PayloadValidationError(`sessions[${index}].type is invalid`);
    }
    return {
      id: requireString(session.id, `sessions[${index}].id`),
      entrantId: requireString(session.entrantId, `sessions[${index}].entrantId`),
      entrantName: requireString(session.entrantName, `sessions[${index}].entrantName`),
      type: type as '1xLong' | '3x20' | '3x10',
      sessionIndex: optionalNumber(session.sessionIndex, `sessions[${index}].sessionIndex`),
      startRowIndex: requireNumber(session.startRowIndex, `sessions[${index}].startRowIndex`),
      endRowIndex: requireNumber(session.endRowIndex, `sessions[${index}].endRowIndex`),
      judgeId: requireString(session.judgeId, `sessions[${index}].judgeId`),
    };
  });

  const slugs: Record<string, string> = {};
  for (const [id, slug] of Object.entries(input.slugs)) {
    slugs[id] = requireString(slug, `slugs.${id}`);
  }

  const slugIndex: PublishedSchedulePayload['slugIndex'] = {};
  for (const [slug, entry] of Object.entries(input.slugIndex)) {
    if (!isRecord(entry)) throw new PayloadValidationError(`slugIndex.${slug} must be an object`);
    const kind = entry.kind;
    if (kind !== 'entrant' && kind !== 'judge') {
      throw new PayloadValidationError(`slugIndex.${slug}.kind is invalid`);
    }
    slugIndex[slug] = { kind, id: requireString(entry.id, `slugIndex.${slug}.id`) };
  }

  return {
    version: 1,
    exportName: optionalString(input.exportName, 'exportName'),
    settings,
    judges,
    entrants,
    sessions,
    slugs,
    slugIndex,
  };
}
