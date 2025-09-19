import type { SessionBlock, Entrant } from '../types';
import { getSettings } from './localStorage';
import { TIME_CONFIG } from '../config/timeConfig';
import jsPDF from 'jspdf';

export function generateFeedbackAnnouncementsPage(doc: jsPDF, scheduledSessions: SessionBlock[], entrants: Entrant[], addNewPage: () => void) {
  addNewPage();
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Feedback Announcements', 20, 20);

  // Create feedback announcements data
  const entrantStartTimes = new Map<string, string>();

  // Find the earliest start time for each entrant
  const settings = getSettings();
  const rowIndexToTime = (rowIndex: number): string => {
    const startTime = settings.startTime;
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const totalMinutes = startMinute + (rowIndex * TIME_CONFIG.MINUTES_PER_SLOT);
    const hour = startHour + Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };
  
  scheduledSessions.forEach(session => {
    const entrant = entrants.find(e => e.id === session.entrantId);
    if (entrant) {
      const startTime = rowIndexToTime(session.startRowIndex!);
      const currentStart = entrantStartTimes.get(entrant.name);
      if (!currentStart || startTime < currentStart) {
        entrantStartTimes.set(entrant.name, startTime);
      }
    }
  });

  // Group entrants by start time
  const groupedByTime = new Map<string, string[]>();
  entrantStartTimes.forEach((startTime, entrantName) => {
    if (!groupedByTime.has(startTime)) {
      groupedByTime.set(startTime, []);
    }
    groupedByTime.get(startTime)!.push(entrantName);
  });

  // Convert to array and sort by start time
  const sortedGroups = Array.from(groupedByTime.entries())
    .sort(([timeA], [timeB]) => timeA.localeCompare(timeB));

  // Add grouped list format
  let yPos = 50;
  doc.setFontSize(12);
  
  sortedGroups.forEach(([startTime, entrantNames]) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    // Time header
    doc.setFont('helvetica', 'bold');
    doc.text(`${startTime}:`, 20, yPos);
    yPos += 12;
    
    // Entrant names under that time
    doc.setFont('helvetica', 'normal');
    entrantNames.forEach(entrantName => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(`  • ${entrantName}`, 30, yPos);
      yPos += 10;
    });
    
    yPos += 5; // Extra space between time groups
  });
}
