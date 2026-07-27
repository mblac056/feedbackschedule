import type { SessionSettings } from '../config/timeConfig';

export interface PublishedJudge {
  id: string;
  name: string;
  category?: 'SNG' | 'MUS' | 'PER';
  roomNumber?: string;
}

export interface PublishedEntrant {
  id: string;
  name: string;
  groupType?: 'Chorus' | 'Quartet' | null;
  roomNumber?: string;
}

export interface PublishedSession {
  id: string;
  entrantId: string;
  entrantName: string;
  type: '1xLong' | '3x20' | '3x10';
  sessionIndex?: number;
  startRowIndex: number;
  endRowIndex: number;
  judgeId: string;
}

export interface PublishedSchedulePayload {
  version: 1;
  exportName?: string;
  settings: Pick<
    SessionSettings,
    'startTime' | 'oneXLongLength' | 'threeX20Length' | 'threeX10Length' | 'moving'
  >;
  judges: PublishedJudge[];
  entrants: PublishedEntrant[];
  sessions: PublishedSession[];
  /** entity id -> slug */
  slugs: Record<string, string>;
  /** slug -> { kind, id } for reverse lookup */
  slugIndex: Record<string, { kind: 'entrant' | 'judge'; id: string }>;
}
