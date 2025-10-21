import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatTimeForDisplay } from './printHelpers';

export interface JudgeSchedule {
  judgeName: string;
  judgeId?: string;
  sessions: Array<{
    entrantName: string;
    startTime: string;
    endTime: string;
    sessionType: string;
    duration: number;
    roomNumber?: string;
    isFirstPreference?: boolean;
    overallSF?: number;
    overallF?: number;
  }>;
  byes: Array<{
    startTime: string;
    endTime: string;
    duration: number;
  }>;
  moving: 'judges' | 'groups';
}

export function generateJudgeSchedulePages(doc: jsPDF, judgeSchedules: JudgeSchedule[], addNewPage: () => void) {
  judgeSchedules.forEach(schedule => {
    addNewPage();
    
    // Title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Feedback Schedule for ${schedule.judgeName}`, 20, 20);
    
    // Add room number at top if groups are moving
    let yPos = 40;
    if (schedule.moving === 'groups' && schedule.sessions.length > 0) {
      const judgeRoom = schedule.sessions[0].roomNumber; // Assuming all sessions have same room for judge
      if (judgeRoom) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Room: ${judgeRoom}`, 20, yPos);
        yPos += 20;
      }
    }
    
    // Sessions Table (including byes)
    if (schedule.sessions.length > 0 || schedule.byes.length > 0) {
      // Determine headers based on movement setting
      const headers = schedule.moving === 'judges' 
        ? ['Time', 'Entrant', 'Session Type', 'Room', 'O/A SF', 'O/A F']
        : ['Time', 'Entrant', 'Session Type', 'O/A SF', 'O/A F'];
      
      // Combine sessions and byes, then sort by start time
      const allItems = [
        ...schedule.sessions.map(session => ({ type: 'session' as const, data: session })),
        ...schedule.byes.map(bye => ({ type: 'bye' as const, data: bye }))
      ].sort((a, b) => {
        const timeA = a.data.startTime;
        const timeB = b.data.startTime;
        return timeA.localeCompare(timeB);
      });
      
      // Prepare table data
      const tableData = allItems.map(item => {
        if (item.type === 'session') {
          const session = item.data;
          // Add asterisk if this is the entrant's first preference judge
          const entrantName = session.isFirstPreference ? `*${session.entrantName}` : session.entrantName;
          
          const baseRow = [
            `${formatTimeForDisplay(session.startTime)}-${formatTimeForDisplay(session.endTime)}`,
            entrantName,
            session.sessionType
          ];
          
          // Add room column if judges are moving
          if (schedule.moving === 'judges') {
            baseRow.push(session.roomNumber || '');
          }
          
          // Add order of appearance columns
          baseRow.push(session.overallSF !== undefined ? session.overallSF.toString() : '');
          baseRow.push(session.overallF !== undefined ? session.overallF.toString() : '');
          
          return baseRow;
        } else {
          // This is a bye
          const bye = item.data;
          const baseRow = [
            `${formatTimeForDisplay(bye.startTime)}-${formatTimeForDisplay(bye.endTime)}`,
            'BYE',
            `${bye.duration} min`
          ];
          
          // Add room column if judges are moving (empty for byes)
          if (schedule.moving === 'judges') {
            baseRow.push('');
          }
          
          // Add order of appearance columns (empty for byes)
          baseRow.push('');
          baseRow.push('');
          
          return baseRow;
        }
      });
      
      // Generate table
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
          0: { cellWidth: 25 }, // Time column
          1: { cellWidth: 35 }, // Entrant column
          2: { cellWidth: 20 }, // Session Type column
          ...(schedule.moving === 'judges' && { 3: { cellWidth: 15 } }), // Room column
          ...(schedule.moving === 'judges' ? { 4: { cellWidth: 15 }, 5: { cellWidth: 15 } } : { 3: { cellWidth: 15 }, 4: { cellWidth: 15 } }) // O/A SF and O/A F columns
        },
        margin: { top: yPos, left: 20, right: 20, bottom: 20 },
      });
      
      yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
    }
  });
}
