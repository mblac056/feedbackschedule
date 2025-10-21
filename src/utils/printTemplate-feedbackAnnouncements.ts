import type { SessionBlock, Entrant, Judge } from '../types';
import { getSettings } from './localStorage';
import { TIME_CONFIG } from '../config/timeConfig';
import jsPDF from 'jspdf';
import { formatTimeForDisplay, timeToSortValue } from './printHelpers';

export function generateFeedbackAnnouncementsPage(doc: jsPDF, scheduledSessions: SessionBlock[], entrants: Entrant[], judges: Judge[]) {
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Feedback Announcements', 20, 20);

  // Create feedback announcements data
  const entrantStartTimes = new Map<string, string>();
  const entrantRooms = new Map<string, string>();

  // Find the earliest start time for each entrant and their starting room
  const settings = getSettings();
  const rowIndexToTime = (rowIndex: number): string => {
    const startTime = settings.startTime;
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const totalMinutes = startMinute + (rowIndex * TIME_CONFIG.MINUTES_PER_SLOT);
    const hour = (startHour + Math.floor(totalMinutes / 60));
    const minute = totalMinutes % 60;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };
  
  scheduledSessions.forEach(session => {
    const entrant = entrants.find(e => e.id === session.entrantId);
    const judge = judges.find(j => j.id === session.judgeId);
    if (entrant) {
      const startTime = rowIndexToTime(session.startRowIndex!);
      const currentStart = entrantStartTimes.get(entrant.name);
      
      // Determine room number based on movement setting
      // If judges are moving: show entrant's room (where they stay)
      // If groups are moving: show judge's room (where they go)
      const roomNumber = settings.moving === 'judges' ? entrant.roomNumber : judge?.roomNumber;
      
      if (!currentStart || startTime < currentStart) {
        entrantStartTimes.set(entrant.name, startTime);
        entrantRooms.set(entrant.name, roomNumber || 'TBD');
      }
    }
  });

  // Group entrants by start time with room information
  const groupedByTime = new Map<string, Array<{ name: string; room: string }>>();
  entrantStartTimes.forEach((startTime, entrantName) => {
    if (!groupedByTime.has(startTime)) {
      groupedByTime.set(startTime, []);
    }
    const room = entrantRooms.get(entrantName) || 'TBD';
    groupedByTime.get(startTime)!.push({ name: entrantName, room });
  });

  // Convert to array and sort by start time
  // Handle times that cross midnight (24:XX, 25:XX, etc.)
  const sortedGroups = Array.from(groupedByTime.entries())
    .sort(([timeA], [timeB]) => timeToSortValue(timeA) - timeToSortValue(timeB));

  // Add grouped list format
  let yPos = 50;
  doc.setFontSize(12);
  
  sortedGroups.forEach(([startTime, entrants]) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    // Time header
    doc.setFont('helvetica', 'bold');
    doc.text(`${formatTimeForDisplay(startTime)}:`, 20, yPos);
    yPos += 12;
    
    // Entrant names under that time with room numbers
    doc.setFont('helvetica', 'normal');
    entrants.forEach(entrant => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(`  • ${entrant.name} (Room ${entrant.room})`, 30, yPos);
      yPos += 10;
    });
    
    yPos += 5; // Extra space between time groups
  });
}
