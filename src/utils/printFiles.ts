import type { Judge, SessionBlock } from '../types';
import { getEntrants, getSettings } from './localStorage';
import { getSessionDurationMinutes, TIME_CONFIG } from '../config/timeConfig';
import jsPDF from 'jspdf';
import { generateMatrixPage } from './printTemplate-matrix';
import { generateJudgeSchedulePages, type JudgeSchedule } from './printTemplate-judgeSchedules';
import { generateEntrantSchedulePages, type EntrantSchedule } from './printTemplate-entrantSchedules';
import { generateFlowDocumentPage } from './printTemplate-flowDocument';
import { generateFeedbackAnnouncementsPage } from './printTemplate-feedbackAnnouncements';
import { generatePreferenceCheckPage, type PreferenceCheckData } from './printTemplate-preferenceCheck';

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

// Types are now imported from template files

export function generatePrintData(scheduledSessions: SessionBlock[], judges: Judge[]) {
  const entrants = getEntrants();
  const settings = getSettings();
  
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

  // Create all session events (start and end)
  const events: SessionEvent[] = [];
  
  scheduledSessions.forEach(session => {
    const entrant = entrants.find(e => e.id === session.entrantId);
    const judge = judges.find(j => j.id === session.judgeId);
    const duration = getSessionDuration(session.type);
    const startTime = rowIndexToTime(session.startRowIndex!);
    const endTime = addMinutesToTime(startTime, duration);
    
    if (entrant && judge) {
      events.push({
        time: startTime,
        type: 'start',
        entrantName: entrant.name,
        judgeName: judge.name,
        sessionType: session.type,
        duration,
        entrantRoom: entrant.roomNumber,
        judgeRoom: judge.roomNumber
      });
      
      events.push({
        time: endTime,
        type: 'end',
        entrantName: entrant.name,
        judgeName: judge.name,
        sessionType: session.type,
        duration,
        entrantRoom: entrant.roomNumber,
        judgeRoom: judge.roomNumber
      });
    }
  });

  // Sort events by time
  // Note: String comparison works here because all times are generated sequentially
  // from the same startTime, so they maintain chronological order even when wrapping
  // around midnight (e.g., 23:55 -> 00:00 -> 00:05)
  events.sort((a, b) => a.time.localeCompare(b.time));

  // Generate judge schedules
  const judgeSchedules: JudgeSchedule[] = judges.map(judge => {
    const judgeSessions = scheduledSessions
      .filter(session => session.judgeId === judge.id)
      .map(session => {
        const entrant = entrants.find(e => e.id === session.entrantId);
        const duration = getSessionDuration(session.type);
        const startTime = rowIndexToTime(session.startRowIndex!);
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

    // Calculate byes (gaps between sessions)
    const byes: Array<{ startTime: string; endTime: string; duration: number }> = [];
    for (let i = 0; i < judgeSessions.length - 1; i++) {
      const currentEnd = judgeSessions[i].endTime;
      const nextStart = judgeSessions[i + 1].startTime;
      
      if (currentEnd !== nextStart) {
        const byeDuration = (() => {
          const [endHours, endMins] = currentEnd.split(':').map(Number);
          const [startHours, startMins] = nextStart.split(':').map(Number);
          let duration = (startHours * 60 + startMins) - (endHours * 60 + endMins);
          // Handle midnight wraparound
          if (duration < 0) {
            duration += 24 * 60; // Add 24 hours in minutes
          }
          return duration;
        })();
        
        byes.push({
          startTime: currentEnd,
          endTime: nextStart,
          duration: byeDuration
        });
      }
    }
    
    // Check for bye between last session and first session (midnight wraparound)
    if (judgeSessions.length > 1) {
      const lastEnd = judgeSessions[judgeSessions.length - 1].endTime;
      const firstStart = judgeSessions[0].startTime;
      
      const [lastEndHours, lastEndMins] = lastEnd.split(':').map(Number);
      const [firstStartHours, firstStartMins] = firstStart.split(':').map(Number);
      const lastEndMinutes = lastEndHours * 60 + lastEndMins;
      const firstStartMinutes = firstStartHours * 60 + firstStartMins;
      
      // If last session ends before first session starts (wraparound), add a bye
      if (lastEndMinutes < firstStartMinutes) {
        const byeDuration = firstStartMinutes - lastEndMinutes;
        byes.push({
          startTime: lastEnd,
          endTime: firstStart,
          duration: byeDuration
        });
      }
    }

    return {
      judgeName: judge.name,
      judgeId: judge.id,
      judgeCategory: judge.category,
      sessions: judgeSessions,
      byes,
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
          const startTime = rowIndexToTime(session.startRowIndex!);
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

      // Calculate byes (gaps between sessions)
      const byes: Array<{ startTime: string; endTime: string; duration: number }> = [];
      for (let i = 0; i < entrantSessions.length - 1; i++) {
        const currentEnd = entrantSessions[i].endTime;
        const nextStart = entrantSessions[i + 1].startTime;
        
        if (currentEnd !== nextStart) {
          const byeDuration = (() => {
            const [endHours, endMins] = currentEnd.split(':').map(Number);
            const [startHours, startMins] = nextStart.split(':').map(Number);
            return (startHours * 60 + startMins) - (endHours * 60 + endMins);
          })();
          
          byes.push({
            startTime: currentEnd,
            endTime: nextStart,
            duration: byeDuration
          });
        }
      }

      return {
        entrantName: entrant.name,
        sessions: entrantSessions,
        byes,
        moving: settings.moving
      };
    });

  // Add bye events for judges
  judgeSchedules.forEach(judgeSchedule => {
    judgeSchedule.byes.forEach(bye => {
      events.push({
        time: bye.startTime,
        type: 'start',
        entrantName: settings.moving === 'judges' ? 'BYE' : judgeSchedule.judgeName,
        judgeName: settings.moving === 'judges' ? judgeSchedule.judgeName : 'BYE',
        sessionType: 'bye',
        duration: bye.duration,
        entrantRoom: undefined,
        judgeRoom: undefined
      });
    });
  });

  // Add bye events for entrants
  entrantSchedules.forEach(entrantSchedule => {
    entrantSchedule.byes.forEach(bye => {
      events.push({
        time: bye.startTime,
        type: 'start',
        entrantName: settings.moving === 'judges' ? 'BYE' : entrantSchedule.entrantName,
        judgeName: settings.moving === 'judges' ? entrantSchedule.entrantName : 'BYE',
        sessionType: 'bye',
        duration: bye.duration,
        entrantRoom: undefined,
        judgeRoom: undefined
      });
    });
  });

  // Re-sort events by time to include bye events
  // Note: String comparison is safe here - all times generated sequentially from startTime
  events.sort((a, b) => a.time.localeCompare(b.time));

  // Generate flow document
  const flowDocument: Array<{ time: string; events: string[] }> = [];
  const timeGroups = new Map<string, string[]>();

  // Group events by time and either entrant or judge (depending on who's moving)
  const eventGroups = new Map<string, Map<string, { start?: SessionEvent; end?: SessionEvent }>>();
  
  events.forEach(event => {
    if (!eventGroups.has(event.time)) {
      eventGroups.set(event.time, new Map());
    }
    
    const timeGroup = eventGroups.get(event.time)!;
    // Group by judge name when judges are moving, entrant name when groups are moving
    const groupKey = settings.moving === 'judges' ? event.judgeName : event.entrantName;
    
    if (!timeGroup.has(groupKey)) {
      timeGroup.set(groupKey, {});
    }
    
    const entityGroup = timeGroup.get(groupKey)!;
    if (event.type === 'start') {
      entityGroup.start = event;
    } else {
      entityGroup.end = event;
    }
  });

  // Convert grouped events to flow text
  eventGroups.forEach((entityGroups, time) => {
    if (!timeGroups.has(time)) {
      timeGroups.set(time, []);
    }
    
    entityGroups.forEach((eventGroup, entityName) => {
      if (eventGroup.start && eventGroup.end) {
        // Both start and end at same time - combine them
        const startRoom = settings.moving === 'judges' ? eventGroup.start.entrantRoom : eventGroup.start.judgeRoom;
        const endRoom = settings.moving === 'judges' ? eventGroup.end.entrantRoom : eventGroup.end.judgeRoom;
        const startRoomText = startRoom ? ` (${startRoom})` : ' (ROOM MISSING)';
        const endRoomText = endRoom ? ` (${endRoom})` : ' (ROOM MISSING)';
        
        let eventText;
        if (settings.moving === 'judges') {
          if (eventGroup.start.sessionType === 'bye') {
            // Judge finishes with entrant and begins bye
            eventText = `${entityName} finishes with ${eventGroup.end.entrantName}${endRoomText} and begins bye (${eventGroup.start.duration} mins)`;
          } else {
            eventText = `${entityName} finishes with ${eventGroup.end.entrantName}${endRoomText} and moves to ${eventGroup.start.entrantName}${startRoomText}`;
          }
        } else {
          if (eventGroup.start.sessionType === 'bye') {
            // Entrant finishes with judge and begins bye
            eventText = `${entityName} finishes with ${eventGroup.end.judgeName}${endRoomText} and begins bye (${eventGroup.start.duration} mins)`;
          } else {
            eventText = `${entityName} finishes with ${eventGroup.end.judgeName}${endRoomText} and moves to ${eventGroup.start.judgeName}${startRoomText}`;
          }
        }
        timeGroups.get(time)!.push(eventText);
      } else if (eventGroup.start) {
        // Only start event
        const room = settings.moving === 'judges' ? eventGroup.start.entrantRoom : eventGroup.start.judgeRoom;
        const roomText = room ? ` (${room})` : ' (ROOM MISSING)';
        
        let eventText;
        if (settings.moving === 'judges') {
          if (eventGroup.start.sessionType === 'bye') {
            eventText = `${entityName} begins bye (${eventGroup.start.duration} mins)`;
          } else {
            eventText = `${entityName} starts with ${eventGroup.start.entrantName}${roomText}`;
          }
        } else {
          if (eventGroup.start.sessionType === 'bye') {
            eventText = `${entityName} begins bye (${eventGroup.start.duration} mins)`;
          } else {
            eventText = `${entityName} starts with ${eventGroup.start.judgeName}${roomText}`;
          }
        }
        timeGroups.get(time)!.push(eventText);
      } else if (eventGroup.end) {
        // Only end event
        const room = settings.moving === 'judges' ? eventGroup.end.entrantRoom : eventGroup.end.judgeRoom;
        const roomText = room ? ` (${room})` : ' (ROOM MISSING)';
        
        let eventText;
        if (settings.moving === 'judges') {
          eventText = `${entityName} finishes with ${eventGroup.end.entrantName}${roomText}`;
        } else {
          eventText = `${entityName} ends with ${eventGroup.end.judgeName}${roomText}`;
        }
        timeGroups.get(time)!.push(eventText);
      }
    });
  });


  // Add 5-minute warnings before session ends
  scheduledSessions.forEach(session => {
    const entrant = entrants.find(e => e.id === session.entrantId);
    const judge = judges.find(j => j.id === session.judgeId);
    const duration = getSessionDuration(session.type);
    const startTime = rowIndexToTime(session.startRowIndex!);
    const endTime = addMinutesToTime(startTime, duration);
    const warningTime = addMinutesToTime(endTime, -5); // 5 minutes before end
    
    if (entrant && judge) {
      if (!timeGroups.has(warningTime)) {
        timeGroups.set(warningTime, []);
      }
      const room = settings.moving === 'judges' ? entrant.roomNumber : judge.roomNumber;
      const roomText = room ? ` (${room})` : ' (ROOM MISSING)';
      timeGroups.get(warningTime)!.push(`Five minute notice to ${judge.name} with ${entrant.name}${roomText}`);
    }
  });

  // Convert to sorted array
  Array.from(timeGroups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([time, events]) => {
      flowDocument.push({ time, events });
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
  scheduledSessions?: Array<{ entrantId: string; type: '1xLong' | '3x20' | '3x10'; }>,
  allSessionBlocks?: Array<{ entrantId: string; type: '1xLong' | '3x20' | '3x10'; }>,
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
  
  // Helper function to check if a group has conflicts for a specific entrant
  const hasGroupConflict = (entrantId: string, groupId: string): boolean => {
    if (!scheduleConflicts) return false;
    return scheduleConflicts.some(conflict => 
      conflict.entrantId === entrantId && conflict.conflictingEntrantId === groupId
    );
  };
  
  // Function to count different types of pills (same logic as PreferencesPanel)
  const getPillCounts = () => {
    let greenCount = 0;
    let redCount = 0;
    let grayCount = 0;

    const includedEntrants = entrants.filter(e => e.includeInSchedule);
    
    includedEntrants.forEach(entrant => {
      // Count group pills
      if (entrant.groupsToAvoid && Array.isArray(entrant.groupsToAvoid)) {
        entrant.groupsToAvoid.forEach(groupId => {
          if (hasGroupConflict(entrant.id, groupId)) {
            redCount++;
          } else {
            greenCount++;
          }
        });
      }

      // Count preference pills
      if (entrant.preference) {
        // Check if any session blocks (scheduled or unscheduled) match their preference
        const entrantSessionBlocks = allSessionBlocks?.filter(block => block.entrantId === entrant.id) || [];
        const hasMatchingSessionType = entrantSessionBlocks.some(block => block.type === entrant.preference);
        
        if (hasMatchingSessionType) {
          greenCount++;
        } else {
          redCount++;
        }
      }

      // Count judge preference pills
      [entrant.judgePreference1, entrant.judgePreference2, entrant.judgePreference3].forEach(judgeId => {
        if (judgeId && judges.find(j => j.id === judgeId)) {
          if (entrantJudgeAssignments?.[entrant.id]?.includes(judgeId)) {
            greenCount++;
          } else {
            grayCount++;
          }
        }
      });
    });

    return { greenCount, redCount, grayCount };
  };

  return {
    entrants,
    judges,
    entrantJudgeAssignments,
    scheduledSessions: scheduledSessions?.map(s => ({ session: { entrantId: s.entrantId, type: s.type } })),
    allSessionBlocks: allSessionBlocks?.map(s => ({ entrantId: s.entrantId, type: s.type })),
    scheduleConflicts,
    pillCounts: getPillCounts()
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
    const footerText = `Generated on ${generatedDateTime}`;
    const textWidth = doc.getTextWidth(footerText);
    const x = (pageWidth - textWidth) / 2;
    const y = pageHeight - 10;
    
    doc.text(footerText, x, y);
    
    // Reset text color to black for subsequent content
    doc.setTextColor(0, 0, 0);
  };

  // Generate requested sections
  if (reports.includes('judgeSchedules')) {
    generateJudgeSchedulePages(doc, printData.judgeSchedules);
  }
  if (reports.includes('entrantSchedules')) {
    generateEntrantSchedulePages(doc, printData.entrantSchedules);
  }
  if (reports.includes('flowDocument')) {
    generateFlowDocumentPage(doc, printData.flowDocument);
  }
  if (reports.includes('feedbackAnnouncements')) {
    generateFeedbackAnnouncementsPage(doc, scheduledSessions, entrants, judges);
  }

  // Add footer to all pages (except entrant schedules)
  if (!reports.includes('entrantSchedules')) {
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
    'flowDocument': 'flow-document',
    'feedbackAnnouncements': 'feedback-announcements',
    'preferenceCheck': 'preference-check'
  };
  
  const filename = reports.length === 1 && reportNames[reports[0]] 
    ? `${reportNames[reports[0]]}.pdf` 
    : 'evaluation-schedule.pdf';

  // Save the PDF
  doc.save(filename);
}
