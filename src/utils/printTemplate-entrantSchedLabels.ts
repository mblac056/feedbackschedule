import jsPDF from 'jspdf';
import { formatTimeForDisplay } from './printHelpers';
import type { EntrantSchedule } from './printTemplate-entrantSchedules';

export function generateEntrantSchedulePages(doc: jsPDF, entrantSchedules: EntrantSchedule[]) {
  const LABELS_PER_PAGE = 10; // 2 columns x 5 rows
  const CELL_WIDTH = 95; // mm
  // Avery 8163 alignment tweaks (mm)
  const COL2_SHIFT_X = 6; // bump 2nd column right
  const TOP_SHIFT_Y = 10; // start first row lower

  const BASE_CELL_HEIGHT = 51; // mm
  // Keep the last row in place: increasing START_Y must be offset by shrinking row height.
  // With 5 rows, there are 4 row-to-row steps.
  const CELL_HEIGHT = BASE_CELL_HEIGHT - TOP_SHIFT_Y / 4; // mm
  const START_X = 5; // mm from left
  const START_Y = 10 + TOP_SHIFT_Y; // mm from top
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
      doc.addPage();
    }

    const startIndex = pageIndex * LABELS_PER_PAGE;
    const endIndex = Math.min(startIndex + LABELS_PER_PAGE, scheduleData.length);
    const pageSchedules = scheduleData.slice(startIndex, endIndex);

    // Draw each label on this page
    for (let i = 0; i < pageSchedules.length; i++) {
      const schedule = pageSchedules[i];
      const row = Math.floor(i / 2);
      const col = i % 2;

      const x = START_X + col * (CELL_WIDTH + GAP_X) + (col === 1 ? COL2_SHIFT_X : 0);
      const y = START_Y + row * (CELL_HEIGHT + GAP_Y);

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
          const roomSuffix = schedule.moving === 'groups' && session.roomNumber ? ` (Rm ${session.roomNumber})` : '';

          doc.text(timeStr + ' - ' + judgeStr + roomSuffix, x + 2, currentY);

          currentY += 5;
        } else {
          const bye = item.data;
          doc.text(`${formatTimeForDisplay(bye.startTime)}-${formatTimeForDisplay(bye.endTime)} - BYE`, x + 2, currentY);
          currentY += 6;
        }
      });
    }
  }
}
