import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Entrant, Judge, EntrantJudgeAssignments } from '../types';

export interface PreferenceCheckData {
  entrants: Entrant[];
  judges: Judge[];
  entrantJudgeAssignments?: EntrantJudgeAssignments;
  scheduledSessions?: Array<{
    session: {
      entrantId: string;
      type: '1xLong' | '3x20' | '3x10';
    };
  }>;
  allSessionBlocks?: Array<{
    entrantId: string;
    type: '1xLong' | '3x20' | '3x10';
  }>;
  scheduleConflicts?: Array<{
    entrantId: string;
    entrantName: string;
    conflictingGroup: string;
    conflictingEntrantId: string;
    conflictingEntrantName: string;
    timeSlot: string;
  }>;
  pillCounts: {
    greenCount: number;
    redCount: number;
    grayCount: number;
  };
}

export function generatePreferenceCheckPage(doc: jsPDF, data: PreferenceCheckData, addNewPage: () => void) {
  addNewPage();
  
  // Title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Preference Check', 20, 20);
  
  const yPos = 30;

  
  // Helper function to check if a group has conflicts for a specific entrant
  const hasGroupConflict = (entrantId: string, groupName: string): boolean => {
    if (!data.scheduleConflicts) return false;
    return data.scheduleConflicts.some(conflict => 
      conflict.entrantId === entrantId && conflict.conflictingGroup === groupName
    );
  };

  // Filter included entrants
  const includedEntrants = data.entrants.filter(e => e.includeInSchedule);
  
  if (includedEntrants.length === 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('No entrants included in schedule yet.', 15, yPos);
    return;
  }
  
  // Prepare table data with color information
  const tableData = includedEntrants.map((entrant, index) => {
    const row = [
      (index + 1).toString(),
      entrant.name,
      entrant.groupsToAvoid || '',
      entrant.preference || '',
      '', // Judge 1
      '', // Judge 2
      '', // Judge 3
    ];
    
    // Add judge preferences
    const judge1 = data.judges.find(j => j.id === entrant.judgePreference1);
    const judge2 = data.judges.find(j => j.id === entrant.judgePreference2);
    const judge3 = data.judges.find(j => j.id === entrant.judgePreference3);
    
    if (judge1) {
      row[4] = judge1.name;
    }
    if (judge2) {
      row[5] = judge2.name;
    }
    if (judge3) {
      row[6] = judge3.name;
    }
    
    return row;
  });

  // Prepare cell styles for text color coding
  const cellStyles: { [key: string]: { textColor: number[] } } = {};
  
  includedEntrants.forEach((entrant, rowIndex) => {
    // Preference column (column 3)
    if (entrant.preference) {
      let isGood = false;
      
      // Check if any session blocks (scheduled or unscheduled) match their preference
      const entrantSessionBlocks = data.allSessionBlocks?.filter(block => block.entrantId === entrant.id) || [];
      isGood = entrantSessionBlocks.some(block => block.type === entrant.preference);
      
      cellStyles[`${rowIndex}-3`] = {
        textColor: isGood ? [22, 101, 52] : [153, 27, 27] // Dark green or dark red
      };
    }

    // Judge columns (columns 4, 5, 6)
    [entrant.judgePreference1, entrant.judgePreference2, entrant.judgePreference3].forEach((judgeId, judgeIndex) => {
      if (judgeId && data.judges.find(j => j.id === judgeId)) {
        const isAssigned = data.entrantJudgeAssignments?.[entrant.id]?.includes(judgeId);
        const columnIndex = 4 + judgeIndex;
        
        cellStyles[`${rowIndex}-${columnIndex}`] = {
          textColor: isAssigned ? [22, 101, 52] : [75, 85, 99] // Dark green or dark gray
        };
      }
    });
  });
  
  // Generate main table
  autoTable(doc, {
    head: [['#', 'Name', 'Groups to Avoid', 'Type', 'Judge 1', 'Judge 2', 'Judge 3']],
    body: tableData,
    startY: yPos,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
      overflow: 'linebreak',
      halign: 'left',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: 5, halign: 'center' }, // #
      1: { cellWidth: 35, halign: 'left' },   // Name
      2: { cellWidth: 50, halign: 'left' },   // Groups to Avoid
      3: { cellWidth: 15, halign: 'center' }, // Preference
      4: { cellWidth: 25, halign: 'left' },   // Judge 1
      5: { cellWidth: 25, halign: 'left' },   // Judge 2
      6: { cellWidth: 25, halign: 'left' }    // Judge 3
    },
    didDrawCell: (data: { section: string; row: { index: number }; column: { index: number }; cell: { x: number; y: number; width: number; height: number; text: string[] } }) => {
      // Skip header row
      if (data.section === 'head') return;
      
      const rowIndex = data.row.index;
      const columnIndex = data.column.index;
      const cellKey = `${rowIndex}-${columnIndex}`;
      
      // Handle Groups to Avoid column (column 2) with mixed colors
      if (columnIndex === 2) {
        const entrant = includedEntrants[rowIndex];
        if (entrant.groupsToAvoid) {
          const groups = entrant.groupsToAvoid.split(' | ');
          let currentY = data.cell.y + 6;
          const lineHeight = 4;
          
          groups.forEach((group) => {
            const hasConflict = hasGroupConflict(entrant.id, group);
            const textColor = hasConflict ? [153, 27, 27] : [22, 101, 52]; // Red or green
            
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            
            const textX = data.cell.x + 2;
            doc.text(group, textX, currentY);
            
            currentY += lineHeight;
          });
          
          // Reset text color to default
          doc.setTextColor(0, 0, 0);
          return;
        }
      }
      
      // Handle other columns with single color
      if (cellStyles[cellKey]) {
        const style = cellStyles[cellKey];
        
        // Set text color
        doc.setTextColor(style.textColor[0], style.textColor[1], style.textColor[2]);
        
        // Draw the text
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        
        const text = data.cell.text[0] || '';
        const textX = data.cell.x + 2;
        const textY = data.cell.y + 6;
        
        doc.text(text, textX, textY);
        
        // Reset text color to default
        doc.setTextColor(0, 0, 0);
      }
    },
    margin: { top: yPos, left: 20, right: 20, bottom: 20 },
  });
}
