import jsPDF from 'jspdf';
import { formatTimeForDisplay } from './printHelpers';

export interface EntrantSchedule {
  entrantName: string;
  sessions: Array<{
    judgeName: string;
    judgeCategory?: string;
    startTime: string;
    endTime: string;
    sessionType: string;
    duration: number;
    roomNumber?: string;
  }>;
  byes: Array<{
    startTime: string;
    endTime: string;
    duration: number;
  }>;
  moving: 'judges' | 'groups';
}

export function generateEntrantSchedulePages(doc: jsPDF, entrantSchedules: EntrantSchedule[], addNewPage: () => void) {
  const LABELS_PER_PAGE = 10; // 2 columns x 5 rows
  const CELL_WIDTH = 95; // mm
  const CELL_HEIGHT = 51; // mm
  const START_X = 7; // mm from left
  const START_Y = 10; // mm from top
  const GAP_X = 5; // mm between columns
  const GAP_Y = 5; // mm between rows
  
  // Process all schedules
  const scheduleData = entrantSchedules.map(schedule => {
    // Combine sessions and byes, then sort by start time
    const allItems = [
      ...schedule.sessions.map(session => ({ type: 'session' as const, data: session })),
      ...schedule.byes.map(bye => ({ type: 'bye' as const, data: bye }))
    ].sort((a, b) => {
      const timeA = a.data.startTime;
      const timeB = b.data.startTime;
      return timeA.localeCompare(timeB);
    });
    
    return {
      name: schedule.entrantName,
      room: schedule.moving === 'judges' && schedule.sessions.length > 0 ? schedule.sessions[0].roomNumber : undefined,
      items: allItems,
      moving: schedule.moving
    };
  });
  
  // Process in batches of 10
  for (let pageIndex = 0; pageIndex < Math.ceil(scheduleData.length / LABELS_PER_PAGE); pageIndex++) {
    // Add new page if not the first page
    if (pageIndex > 0) {
      addNewPage();
    }
    
    const startIndex = pageIndex * LABELS_PER_PAGE;
    const endIndex = Math.min(startIndex + LABELS_PER_PAGE, scheduleData.length);
    const pageSchedules = scheduleData.slice(startIndex, endIndex);
    
    // Draw each label on this page
    for (let i = 0; i < pageSchedules.length; i++) {
      const schedule = pageSchedules[i];
      const row = Math.floor(i / 2);
      const col = i % 2;
      
      const x = START_X + col * (CELL_WIDTH + GAP_X);
      const y = START_Y + row * (CELL_HEIGHT + GAP_Y);
      
      // Draw border
      //doc.setDrawColor(0, 0, 0);
      // doc.setLineWidth(0.5);
      // doc.rect(x, y, CELL_WIDTH, CELL_HEIGHT);
      
      // Draw content
      let currentY = y + 5;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(schedule.name, x + 2, currentY);
      currentY += 5;
      
      if (schedule.room) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Room: ${schedule.room}`, x + 2, currentY);
        currentY += 4;
      }
      
      currentY += 2;
      
      // Draw sessions
      doc.setFontSize(10);
      schedule.items.forEach(item => {
        if (item.type === 'session') {
          const session = item.data;
          const timeStr = `${formatTimeForDisplay(session.startTime)}-${formatTimeForDisplay(session.endTime)}`;
          const judgeStr = session.judgeName + (session.judgeCategory ? ` (${session.judgeCategory})` : '');
          const locationStr = (schedule.moving === 'groups' && session.roomNumber ? `Rm ${session.roomNumber}` : '');
          
          doc.text(timeStr + ' - ' + judgeStr + ' (' + locationStr + ')', x + 2, currentY);

          currentY += 5;
        } else {
          // Bye
          const bye = item.data;
          doc.text(`${formatTimeForDisplay(bye.startTime)}-${formatTimeForDisplay(bye.endTime)} - BYE`, x + 2, currentY);
          currentY += 6;
        }
      });
    }
  }
}
