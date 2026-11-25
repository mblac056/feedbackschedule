import type { Judge, SessionBlock } from '../types';
import { getEntrants, getSettings, getPreferenceNotes } from './localStorage';
import { countPreferencePills } from './preferencePills';
import { getSessionDurationMinutes, TIME_CONFIG, type SessionSettings } from '../config/timeConfig';
import { buildFlowDocument } from './flowDocument';
import { addMinutesToTime, findByes, rowIndexToTime } from './scheduleTime';
import jsPDF from 'jspdf';
import { generateMatrixPage } from './printTemplate-matrix';
import { generateJudgeSchedulePages, type JudgeSchedule } from './printTemplate-judgeSchedules';
import { generateEntrantScheduleSummaryPages, type EntrantSchedule } from './printTemplate-entrantSchedules';
import { generateEntrantSchedulePages } from './printTemplate-entrantSchedLabels';
import { generateFlowDocumentPage } from './printTemplate-flowDocument';
import { generateFeedbackAnnouncementsPage } from './printTemplate-feedbackAnnouncements';
import { generatePreferenceCheckPage, type PreferenceCheckData } from './printTemplate-preferenceCheck';
import {
  buildSharedRoomGuideData,
  generateSharedRoomGuidePage,
} from './printTemplate-sharedRoomGuide';

// Types are now imported from template files

/**
 * Calculate total bye length (in minutes) for a group between their first session start and last session end.
 * This represents the total time the group spends in breaks/byes.
 * 
 * @param entrantSessions - Scheduled sessions for the entrant
 * @param settings - Session settings containing startTime and session durations
 * @returns Total bye length in minutes, or 0 if no sessions or only one session
 */
export function calculateTotalByeLength(
  entrantSessions: SessionBlock[],
  settings: SessionSettings
): number {
  // Filter to only scheduled sessions with valid row indices
  const scheduledSessions = entrantSessions.filter(
    s => s.isScheduled && s.startRowIndex !== undefined
  );
  
  if (scheduledSessions.length === 0 || scheduledSessions.length === 1) {
    return 0; // No byes if no sessions or only one session
  }
  
  // Helper function to convert row index to time string
  const rowIndexToTime = (rowIndex: number): string => {
    const startTime = settings.startTime;
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const totalMinutes = startMinute + (rowIndex * TIME_CONFIG.MINUTES_PER_SLOT);
    const hour = (startHour + Math.floor(totalMinutes / 60));
    const minute = totalMinutes % 60;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };
  
  // Helper function to get session duration in minutes
  const getSessionDuration = (sessionType: string): number => {
    return getSessionDurationMinutes(sessionType as '1xLong' | '3x20' | '3x10', settings);
  };
  
  // Helper function to add minutes to time string
  const addMinutesToTime = (timeStr: string, minutes: number): string => {
    const [hours, mins] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  };
  
  // Find first session start time and last session end time
  let firstStartTime: string | null = null;
  let lastEndTime: string | null = null;
  let totalSessionTime = 0;
  
  scheduledSessions.forEach(session => {
    const startTime = rowIndexToTime(session.startRowIndex!);
    const duration = getSessionDuration(session.type);
    const endTime = addMinutesToTime(startTime, duration);
    
    if (firstStartTime === null || startTime < firstStartTime) {
      firstStartTime = startTime;
    }
    
    if (lastEndTime === null || endTime > lastEndTime) {
      lastEndTime = endTime;
    }
    
    totalSessionTime += duration;
  });
  
  if (!firstStartTime || !lastEndTime) {
    return 0;
  }
  
  // Calculate total span between first start and last end
  // TypeScript assertion: we've already checked these are non-null
  const startTime = firstStartTime as string;
  const endTime = lastEndTime as string;
  const [firstStartHours, firstStartMins] = startTime.split(':').map(Number);
  const [lastEndHours, lastEndMins] = endTime.split(':').map(Number);
  const firstStartMinutes = firstStartHours * 60 + firstStartMins;
  const lastEndMinutes = lastEndHours * 60 + lastEndMins;
  
  let totalSpanMinutes = lastEndMinutes - firstStartMinutes;
  // Handle midnight wraparound
  if (totalSpanMinutes < 0) {
    totalSpanMinutes += 24 * 60;
  }
  
  // Total bye = total span - total session time
  return totalSpanMinutes - totalSessionTime;
}

export function generatePrintData(scheduledSessions: SessionBlock[], judges: Judge[]) {
  const entrants = getEntrants();
  const settings = getSettings();

  const getSessionDuration = (sessionType: SessionBlock['type']): number =>
    getSessionDurationMinutes(sessionType, settings);

  // Generate judge schedules
  const judgeSchedules: JudgeSchedule[] = judges.map(judge => {
    const judgeSessions = scheduledSessions
      .filter(session => session.judgeId === judge.id)
      .map(session => {
        const entrant = entrants.find(e => e.id === session.entrantId);
        const duration = getSessionDuration(session.type);
        const startTime = rowIndexToTime(session.startRowIndex!, settings.startTime);
        const isFirstPreference = entrant?.judgePreference1 === judge.id;
        return {
          entrantName: entrant?.name || 'Unknown',
          startTime: startTime,
          endTime: addMinutesToTime(startTime, duration),
          sessionType: session.type,
          duration,
          // If judges are moving, show entrant's room; if entrants are moving, show judge's room
          roomNumber: settings.moving === 'judges' ? entrant?.roomNumber : judge.roomNumber,
          isFirstPreference,
          overallSF: entrant?.overallSF,
          overallF: entrant?.overallF
        };
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime)); // Safe: times generated sequentially

    return {
      judgeName: judge.name,
      judgeId: judge.id,
      judgeCategory: judge.category,
      sessions: judgeSessions,
      byes: findByes(judgeSessions, { wrapMidnight: true }),
      moving: settings.moving
    };
  });

  // Generate entrant schedules
  const entrantSchedules: EntrantSchedule[] = entrants
    .filter(entrant => scheduledSessions.some(session => session.entrantId === entrant.id))
    .map(entrant => {
      const entrantSessions = scheduledSessions
        .filter(session => session.entrantId === entrant.id)
        .map(session => {
          const judge = judges.find(j => j.id === session.judgeId);
          const duration = getSessionDuration(session.type);
          const startTime = rowIndexToTime(session.startRowIndex!, settings.startTime);
          return {
            judgeName: judge?.name || 'Unknown',
            judgeCategory: judge?.category,
            startTime: startTime,
            endTime: addMinutesToTime(startTime, duration),
            sessionType: session.type,
            duration,
            // If judges are moving, show entrant's room; if entrants are moving, show judge's room
            roomNumber: settings.moving === 'judges' ? entrant.roomNumber : judge?.roomNumber
          };
        })
        .sort((a, b) => a.startTime.localeCompare(b.startTime)); // Safe: times generated sequentially

      return {
        entrantName: entrant.name,
        sessions: entrantSessions,
        byes: findByes(entrantSessions, { wrapMidnight: false }),
        moving: settings.moving
      };
    });

  const flowDocument = buildFlowDocument({
    sessions: scheduledSessions,
    entrants,
    judges,
    settings,
  });

  return {
    judgeSchedules,
    entrantSchedules,
    flowDocument
  };
}

export function generatePreferenceCheckData(
  judges: Judge[], 
  entrantJudgeAssignments?: { [entrantId: string]: string[] },
  scheduledSessions?: SessionBlock[] | Array<{ entrantId: string; type: '1xLong' | '3x20' | '3x10'; }>,
  allSessionBlocks?: Array<{ entrantId: string; type: '1xLong' | '3x20' | '3x10'; }> | SessionBlock[],
  scheduleConflicts?: Array<{
    entrantId: string;
    entrantName: string;
    conflictingGroup: string;
    conflictingEntrantId: string;
    conflictingEntrantName: string;
    timeSlot: string;
  }>
): PreferenceCheckData {
  const entrants = getEntrants();
  const settings = getSettings();
  const pillCounts = countPreferencePills({
    entrants,
    judges,
    sessionBlocks: allSessionBlocks,
    assignments: entrantJudgeAssignments,
    conflicts: scheduleConflicts,
  });

  // Calculate total bye lengths for each entrant
  const entrantByeLengths: { [entrantId: string]: number } = {};
  if (scheduledSessions && scheduledSessions.length > 0) {
    // Check if scheduledSessions is SessionBlock[] format (has startRowIndex property)
    const isSessionBlockFormat = 'startRowIndex' in scheduledSessions[0] || 
                                 (scheduledSessions[0] && 'isScheduled' in scheduledSessions[0]);
    
    if (isSessionBlockFormat) {
      // Use SessionBlock[] directly
      const sessionsByEntrant = new Map<string, SessionBlock[]>();
      (scheduledSessions as SessionBlock[]).forEach(session => {
        if (session.isScheduled && session.startRowIndex !== undefined) {
          if (!sessionsByEntrant.has(session.entrantId)) {
            sessionsByEntrant.set(session.entrantId, []);
          }
          sessionsByEntrant.get(session.entrantId)!.push(session);
        }
      });
      
      // Calculate bye length for each entrant
      sessionsByEntrant.forEach((sessions, entrantId) => {
        entrantByeLengths[entrantId] = calculateTotalByeLength(sessions, settings);
      });
    } else if (allSessionBlocks && Array.isArray(allSessionBlocks) && allSessionBlocks.length > 0) {
      // If scheduledSessions is in simplified format, map to SessionBlock[] using allSessionBlocks
      const isAllSessionBlocksFormat = 'startRowIndex' in allSessionBlocks[0] || 
                                       (allSessionBlocks[0] && 'isScheduled' in allSessionBlocks[0]);
      
      if (isAllSessionBlocksFormat) {
        // allSessionBlocks is already SessionBlock[]
        const scheduledSessionBlocks = (allSessionBlocks as SessionBlock[])
          .filter(block => block.isScheduled && block.startRowIndex !== undefined);
        
        // Group sessions by entrant
        const sessionsByEntrant = new Map<string, SessionBlock[]>();
        scheduledSessionBlocks.forEach(session => {
          if (!sessionsByEntrant.has(session.entrantId)) {
            sessionsByEntrant.set(session.entrantId, []);
          }
          sessionsByEntrant.get(session.entrantId)!.push(session);
        });
        
        // Calculate bye length for each entrant
        sessionsByEntrant.forEach((sessions, entrantId) => {
          entrantByeLengths[entrantId] = calculateTotalByeLength(sessions, settings);
        });
      }
    }
  }

  return {
    entrants,
    judges,
    entrantJudgeAssignments,
    scheduledSessions: scheduledSessions?.map(s => ({ session: { entrantId: s.entrantId, type: s.type } })),
    allSessionBlocks: allSessionBlocks?.map(s => ({ entrantId: s.entrantId, type: s.type })),
    scheduleConflicts,
    pillCounts,
    entrantByeLengths,
    preferenceNotes: getPreferenceNotes() || undefined
  };
}

export async function generatePDF(
  scheduledSessions: SessionBlock[], 
  judges: Judge[], 
  reports: string[] = ['matrix'],
  entrantJudgeAssignments?: { [entrantId: string]: string[] },
  allSessionBlocks?: SessionBlock[],
  scheduleConflicts?: Array<{
    entrantId: string;
    entrantName: string;
    conflictingGroup: string;
    conflictingEntrantId: string;
    conflictingEntrantName: string;
    timeSlot: string;
  }>
) {
  const entrants = getEntrants();
  const settings = getSettings();
  const feedbackRound = settings.exportName?.trim();
  const feedbackRoundFooterSuffix = feedbackRound ? ` - ${feedbackRound}` : '';
  
  // Generate matrix separately if requested
  if (reports.includes('matrix')) {
    const matrixBlob = await generateMatrixPage(scheduledSessions, judges, entrants);
    const url = URL.createObjectURL(matrixBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schedule-matrix.pdf';
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // Generate preference check separately if requested
  if (reports.includes('preferenceCheck')) {
    const preferenceCheckData = generatePreferenceCheckData(judges, entrantJudgeAssignments, scheduledSessions, allSessionBlocks, scheduleConflicts);
    const preferenceCheckBlob = await generatePreferenceCheckPage(preferenceCheckData);
    const url = URL.createObjectURL(preferenceCheckBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'preference-check.pdf';
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // Shared Room Guide (judges-move mode only)
  if (reports.includes('sharedRoomGuide')) {
    const sharedRoomGuideData = buildSharedRoomGuideData(scheduledSessions, entrants, settings);
    const doc = new jsPDF('portrait');
    generateSharedRoomGuidePage(doc, sharedRoomGuideData);

    const generatedDateTime = new Date().toLocaleString();
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.width;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(128, 128, 128);
      const footerText = `Generated on ${generatedDateTime}${feedbackRoundFooterSuffix}`;
      const textWidth = doc.getTextWidth(footerText);
      doc.text(footerText, (pageWidth - textWidth) / 2, pageHeight - 10);
      doc.setTextColor(0, 0, 0);
    }

    doc.save('shared-room-guide.pdf');
    return;
  }

  // Generate other reports
  const printData = generatePrintData(scheduledSessions, judges);
  
  // Create document
  const doc = new jsPDF('portrait');
  const generatedDateTime = new Date().toLocaleString();

  // Helper function to add footer to current page
  const addFooter = () => {
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128); // Gray color
    
    // Add footer text centered at bottom
    const footerText = `Generated on ${generatedDateTime}${feedbackRoundFooterSuffix}`;
    const textWidth = doc.getTextWidth(footerText);
    const x = (pageWidth - textWidth) / 2;
    const y = pageHeight - 10;
    
    doc.text(footerText, x, y);
    
    // Reset text color to black for subsequent content
    doc.setTextColor(0, 0, 0);
  };

  // Generate requested sections
  if (reports.includes('judgeSchedules')) {
    generateJudgeSchedulePages(doc, printData.judgeSchedules, settings.timeFormat);
  }
  if (reports.includes('entrantSchedules')) {
    generateEntrantScheduleSummaryPages(doc, printData.entrantSchedules, settings.timeFormat);
  }
  if (reports.includes('entrantSchedLabels')) {
    generateEntrantSchedulePages(doc, printData.entrantSchedules, settings.timeFormat);
  }
  if (reports.includes('flowDocument')) {
    generateFlowDocumentPage(doc, printData.flowDocument, feedbackRound, settings.timeFormat);
  }
  if (reports.includes('feedbackAnnouncements')) {
    generateFeedbackAnnouncementsPage(doc, scheduledSessions, entrants, judges);
  }

  // Add footer to all pages (except entrant sched. labels)
  if (!reports.includes('entrantSchedLabels')) {
    const pageCount = doc.internal.pages.length - 1; // jsPDF is 0-indexed
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addFooter();
    }
    // Reset to page 1 after adding footers
    doc.setPage(1);
  }

  // Determine filename based on report type
  const reportNames: { [key: string]: string } = {
    'judgeSchedules': 'judge-schedules',
    'entrantSchedules': 'entrant-schedules',
    'entrantSchedLabels': 'entrant-sched-labels',
    'flowDocument': 'flow-document',
    'feedbackAnnouncements': 'feedback-announcements',
    'preferenceCheck': 'preference-check',
    'sharedRoomGuide': 'shared-room-guide',
  };
  
  const filename = reports.length === 1 && reportNames[reports[0]] 
    ? `${reportNames[reports[0]]}.pdf` 
    : 'evaluation-schedule.pdf';

  // Save the PDF
  doc.save(filename);
}
