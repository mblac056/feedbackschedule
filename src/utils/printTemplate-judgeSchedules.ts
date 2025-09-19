import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface JudgeSchedule {
  judgeName: string;
  sessions: Array<{
    entrantName: string;
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
    
    // Sessions Table
    if (schedule.sessions.length > 0) {
      // Determine headers based on movement setting
      const headers = schedule.moving === 'judges' 
        ? ['Time', 'Entrant', 'Session Type', 'Room']
        : ['Time', 'Entrant', 'Session Type'];
      
      // Prepare table data
      const tableData = schedule.sessions.map(session => {
        const baseRow = [
          `${session.startTime}-${session.endTime}`,
          session.entrantName,
          session.sessionType
        ];
        
        // Add room column if judges are moving
        if (schedule.moving === 'judges') {
          baseRow.push(session.roomNumber || '');
        }
        
        return baseRow;
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
          0: { cellWidth: 30 }, // Time column
          1: { cellWidth: 50 }, // Entrant column
          2: { cellWidth: 25 }, // Session Type column
          ...(schedule.moving === 'judges' && { 3: { cellWidth: 20 } }) // Room column
        },
        margin: { top: yPos, left: 20, right: 20, bottom: 20 },
      });
      
      yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
    }
    
    // Byes Table
    if (schedule.byes.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Byes:', 20, yPos);
      yPos += 15;
      
      const byeHeaders = ['Start Time', 'End Time', 'Duration'];
      const byeData = schedule.byes.map(bye => [
        bye.startTime,
        bye.endTime,
        `${bye.duration} minutes`
      ]);
      
      autoTable(doc, {
        head: [byeHeaders],
        body: byeData,
        startY: yPos,
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: 3,
          lineColor: [180, 180, 180],
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: [108, 117, 125],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 30 },
          2: { cellWidth: 30 }
        },
        margin: { top: yPos, left: 20, right: 20, bottom: 20 },
      });
    }
  });
}
