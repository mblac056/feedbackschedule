import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

/** One page per entrant with a table (same style as Judge Schedules). */
export function generateEntrantScheduleSummaryPages(doc: jsPDF, entrantSchedules: EntrantSchedule[]) {
  entrantSchedules.forEach((schedule, index) => {
    if (index > 0) {
      doc.addPage();
    }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Feedback Schedule for ${schedule.entrantName}`, 20, 20);

    let yPos = 40;
    if (schedule.moving === 'judges' && schedule.sessions.length > 0) {
      const entrantRoom = schedule.sessions[0].roomNumber;
      if (entrantRoom) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Room: ${entrantRoom}`, 20, yPos);
        yPos += 20;
      }
    }

    if (schedule.sessions.length > 0 || schedule.byes.length > 0) {
      const headers = schedule.moving === 'groups'
        ? ['Time', 'Judge', 'Session Type', 'Room']
        : ['Time', 'Judge', 'Session Type'];

      const allItems = [
        ...schedule.sessions.map(session => ({ type: 'session' as const, data: session })),
        ...schedule.byes.map(bye => ({ type: 'bye' as const, data: bye }))
      ].sort((a, b) => a.data.startTime.localeCompare(b.data.startTime));

      const tableData = allItems.map(item => {
        if (item.type === 'session') {
          const session = item.data;
          const judgeStr = session.judgeName + (session.judgeCategory ? ` (${session.judgeCategory})` : '');
          const baseRow = [
            `${formatTimeForDisplay(session.startTime)}-${formatTimeForDisplay(session.endTime)}`,
            judgeStr,
            session.sessionType
          ];
          if (schedule.moving === 'groups') {
            baseRow.push(session.roomNumber || '');
          }
          return baseRow;
        } else {
          const bye = item.data;
          const baseRow = [
            `${formatTimeForDisplay(bye.startTime)}-${formatTimeForDisplay(bye.endTime)}`,
            'BYE',
            `${bye.duration} min`
          ];
          if (schedule.moving === 'groups') {
            baseRow.push('');
          }
          return baseRow;
        }
      });

      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: yPos,
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: 3,
          lineColor: [180, 180, 180],
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: [66, 139, 202],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 45 },
          2: { cellWidth: 22 },
          ...(schedule.moving === 'groups' && { 3: { cellWidth: 15 } }),
        },
        margin: { top: yPos, left: 20, right: 20, bottom: 20 },
      });
    }
  });
}
