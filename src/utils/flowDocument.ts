import { getSessionDurationMinutes, type SessionSettings } from '../config/timeConfig';
import type { PublishedSchedulePayload } from '../types/publishedSchedule';
import { addMinutesToTime, findByes, rowIndexToTime } from './scheduleTime';

export interface FlowDocumentEntry {
  /** Extended-hour "HH:MM" (may be >= 24:00 for schedules past midnight). */
  time: string;
  events: string[];
}

type SessionType = '1xLong' | '3x20' | '3x10';

export interface FlowDocumentInput {
  /** Only sessions with a judge and a start row are used. */
  sessions: Array<{
    entrantId: string;
    judgeId?: string;
    type: SessionType;
    startRowIndex?: number;
  }>;
  entrants: Array<{ id: string; name: string; roomNumber?: string }>;
  judges: Array<{ id: string; name: string; roomNumber?: string }>;
  settings: Pick<
    SessionSettings,
    'startTime' | 'oneXLongLength' | 'threeX20Length' | 'threeX10Length' | 'moving'
  >;
}

interface SessionEvent {
  time: string;
  type: 'start' | 'end';
  entrantName: string;
  judgeName: string;
  sessionType: string;
  duration: number;
  entrantRoom?: string;
  judgeRoom?: string;
}

/**
 * Minute-by-minute list of who starts, finishes, moves, goes on a bye, or gets
 * an end-of-session notice. Used by the printed flow document and the
 * published schedule's live flow view.
 */
export function buildFlowDocument(input: FlowDocumentInput): FlowDocumentEntry[] {
  const { entrants, judges, settings } = input;
  const moving = settings.moving;
  const sessions = input.sessions.filter(
    (s): s is typeof s & { judgeId: string; startRowIndex: number } =>
      Boolean(s.judgeId) && s.startRowIndex !== undefined
  );

  const timed = sessions.map((session) => {
    const duration = getSessionDurationMinutes(session.type, settings);
    const startTime = rowIndexToTime(session.startRowIndex, settings.startTime);
    return {
      session,
      duration,
      startTime,
      endTime: addMinutesToTime(startTime, duration),
      entrant: entrants.find((e) => e.id === session.entrantId),
      judge: judges.find((j) => j.id === session.judgeId),
    };
  });

  const events: SessionEvent[] = [];
  timed.forEach(({ session, duration, startTime, endTime, entrant, judge }) => {
    if (!entrant || !judge) return;
    const base = {
      entrantName: entrant.name,
      judgeName: judge.name,
      sessionType: session.type,
      duration,
      entrantRoom: entrant.roomNumber,
      judgeRoom: judge.roomNumber,
    };
    events.push({ time: startTime, type: 'start', ...base });
    events.push({ time: endTime, type: 'end', ...base });
  });

  // String comparison is safe: all times share one extended-hour clock.
  events.sort((a, b) => a.time.localeCompare(b.time));

  const sortedFor = (predicate: (t: (typeof timed)[number]) => boolean) =>
    timed
      .filter(predicate)
      .map((t) => ({ startTime: t.startTime, endTime: t.endTime }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const pushBye = (name: string, bye: { startTime: string; duration: number }) => {
    events.push({
      time: bye.startTime,
      type: 'start',
      entrantName: moving === 'judges' ? 'BYE' : name,
      judgeName: moving === 'judges' ? name : 'BYE',
      sessionType: 'bye',
      duration: bye.duration,
    });
  };

  judges.forEach((judge) => {
    findByes(sortedFor((t) => t.session.judgeId === judge.id), { wrapMidnight: true })
      .forEach((bye) => pushBye(judge.name, bye));
  });

  entrants
    .filter((entrant) => sessions.some((s) => s.entrantId === entrant.id))
    .forEach((entrant) => {
      findByes(sortedFor((t) => t.session.entrantId === entrant.id), { wrapMidnight: false })
        .forEach((bye) => pushBye(entrant.name, bye));
    });

  events.sort((a, b) => a.time.localeCompare(b.time));

  // Group by time, then by whoever is moving (judge when judges move, entrant otherwise).
  const eventGroups = new Map<string, Map<string, { start?: SessionEvent; end?: SessionEvent }>>();
  events.forEach((event) => {
    if (!eventGroups.has(event.time)) eventGroups.set(event.time, new Map());
    const timeGroup = eventGroups.get(event.time)!;
    const groupKey = moving === 'judges' ? event.judgeName : event.entrantName;
    if (!timeGroup.has(groupKey)) timeGroup.set(groupKey, {});
    const entityGroup = timeGroup.get(groupKey)!;
    if (event.type === 'start') entityGroup.start = event;
    else entityGroup.end = event;
  });

  const roomText = (room?: string) => (room ? ` (${room})` : ' (ROOM MISSING)');
  const destinationRoom = (event: SessionEvent) =>
    moving === 'judges' ? event.entrantRoom : event.judgeRoom;
  const counterpart = (event: SessionEvent) =>
    moving === 'judges' ? event.entrantName : event.judgeName;

  const timeGroups = new Map<string, string[]>();
  eventGroups.forEach((entityGroups, time) => {
    if (!timeGroups.has(time)) timeGroups.set(time, []);

    entityGroups.forEach(({ start, end }, entityName) => {
      let text: string | undefined;
      if (start && end) {
        const finished = `${entityName} finishes with ${counterpart(end)}${roomText(destinationRoom(end))}`;
        text = start.sessionType === 'bye'
          ? `${finished} and begins bye (${start.duration} mins)`
          : `${finished} and moves to ${counterpart(start)}${roomText(destinationRoom(start))}`;
      } else if (start) {
        text = start.sessionType === 'bye'
          ? `${entityName} begins bye (${start.duration} mins)`
          : `${entityName} starts with ${counterpart(start)}${roomText(destinationRoom(start))}`;
      } else if (end) {
        const verb = moving === 'judges' ? 'finishes' : 'ends';
        text = `${entityName} ${verb} with ${counterpart(end)}${roomText(destinationRoom(end))}`;
      }
      if (text) timeGroups.get(time)!.push(text);
    });
  });

  // Warn before a session ends: 2 minutes for 3x10, 5 minutes otherwise.
  timed.forEach(({ session, endTime, entrant, judge }) => {
    if (!entrant || !judge) return;
    const warningLeadMinutes = session.type === '3x10' ? 2 : 5;
    const warningTime = addMinutesToTime(endTime, -warningLeadMinutes);
    if (!timeGroups.has(warningTime)) timeGroups.set(warningTime, []);
    const room = moving === 'judges' ? entrant.roomNumber : judge.roomNumber;
    const noticeLabel = warningLeadMinutes === 2 ? 'Two-minute' : 'Five-minute';
    timeGroups.get(warningTime)!.push(
      `${noticeLabel} notice to ${judge.name} with ${entrant.name}${roomText(room)}`
    );
  });

  return Array.from(timeGroups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, entryEvents]) => ({ time, events: entryEvents }));
}

export function buildFlowDocumentFromPayload(payload: PublishedSchedulePayload): FlowDocumentEntry[] {
  return buildFlowDocument({
    sessions: payload.sessions,
    entrants: payload.entrants,
    judges: payload.judges,
    settings: payload.settings,
  });
}
