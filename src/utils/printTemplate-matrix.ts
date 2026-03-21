import type { Judge, SessionBlock, Entrant } from '../types';
import { getSettings } from './localStorage';
import { getSessionDurationMinutes, TIME_CONFIG } from '../config/timeConfig';
import html2pdf from 'html2pdf.js';

export async function generateMatrixPage(
  scheduledSessions: SessionBlock[],
  judges: Judge[],
  entrants: Entrant[]
): Promise<Blob> {
  const settings = getSettings();
  const getSessionDuration = (t: string) => getSessionDurationMinutes(t as '1xLong' | '3x20' | '3x10', settings);
  /** Fixed height per time-slot row (px); session rowspan cells use `rowSpan * SLOT_ROW_PX`. */
  const SLOT_ROW_PX = 23;
  
  // Helper function to convert row index to time string
  const rowIndexToTime = (rowIndex: number): string => {
    const startTime = settings.startTime;
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const totalMinutes = startMinute + (rowIndex * TIME_CONFIG.MINUTES_PER_SLOT);
    const hour = (startHour + Math.floor(totalMinutes / 60)) % 24;
    const minute = totalMinutes % 60;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  // Find the range of row indices used by sessions
  const allRowIndices = new Set<number>();
  for (const ss of scheduledSessions) {
    const dur = getSessionDuration(ss.type);
    const startRow = ss.startRowIndex!;
    const endRow = startRow + Math.ceil(dur / TIME_CONFIG.MINUTES_PER_SLOT) - 1;
    allRowIndices.add(startRow);
    allRowIndices.add(endRow);
  }
  const sortedRowIndices = Array.from(allRowIndices).sort((a, b) => a - b);
  const minRow = sortedRowIndices[0];
  const maxRow = sortedRowIndices[sortedRowIndices.length - 1];

  // Generate intervals based on row indices
  const intervals: string[] = [];
  for (let row = minRow; row <= maxRow; row++) {
    intervals.push(rowIndexToTime(row));
  }

  // Build lookup maps
  const judgeColIndexById = new Map<string, number>();
  judges.forEach((j, idx) => judgeColIndexById.set(j.id, idx + 1));
  const entrantNameById = new Map(entrants.map((e) => [e.id, e.name]));

  // Build HTML table
  let html = `
    <style>
      body { margin: 0; padding: 20px; font-family: Arial, sans-serif; color: #000; }
      h1 { font-size: 20px; font-weight: bold; margin-bottom: 10px; color: #000; }
      table { width: 100%; border-collapse: collapse; font-size: 16px; table-layout: fixed; }
      th { background-color: #d3d3d3; color: #000; padding: 8px; text-align: center; font-weight: bold; border: 1px solid #666; }
      tbody tr { height: ${SLOT_ROW_PX}px; }
      td { height: ${SLOT_ROW_PX}px; min-height: ${SLOT_ROW_PX}px; padding: 4px 6px; box-sizing: border-box; background-color:rgb(243, 243, 243); border: 1px solid #000; text-align: center; vertical-align: middle; color: #000; }
      .time-col { line-height: 1.1; padding: 4px; background-color: #d3d3d3; width: 50px; font-size: 12px;}
      .session-cell { background-color:#ffffff; vertical-align: middle; }
      .session-entrant-name { font-size: 14px; line-height: 1.2; }
      .session-duration { font-size: 11px; line-height: 1.15; color: #333; }
      @media print {
        @page { size: legal landscape; margin: 0.4in; }
      }
    </style>
    <h1>Schedule Matrix</h1>
    <table>
      <thead>
        <tr>
          <th>Time</th>
          ${judges.map(j => {
            const roomText = settings.moving === 'groups' && j.roomNumber ? `<br>${j.roomNumber}` : '';
            return `<th>${j.category ? `${j.name} (${j.category})` : j.name}${roomText}</th>`;
          }).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  // Create a 2D array to track which cells are occupied
  const cellOccupied: boolean[][] = intervals.map(() => new Array(judges.length + 1).fill(false));

  // Add rows with sessions
  intervals.forEach((time, rowIndex) => {
    html += `<tr>`;
    
    // Time column
    html += `<td class="time-col">${time}</td>`;
    
    // Judge columns
    judges.forEach((judge, colIndex) => {
      const cellIndex = colIndex + 1;
      
      if (cellOccupied[rowIndex][cellIndex]) {
        // Cell is occupied by a rowSpan from above, skip it
        return;
      }
      
      // Check if there's a session starting at this cell
      const session = scheduledSessions.find(ss => {
        if (ss.judgeId !== judge.id) return false;
        const startRowIndex = ss.startRowIndex!;
        const startRow = startRowIndex - minRow;
        return startRow === rowIndex;
      });
      
      if (session) {
        const dur = getSessionDuration(session.type);
        const startRowIndex = session.startRowIndex!;
        const endRowIndex = startRowIndex + Math.ceil(dur / TIME_CONFIG.MINUTES_PER_SLOT) - 1;
        const rowSpan = endRowIndex - startRowIndex + 1;
        
        let entrantName = entrantNameById.get(session.entrantId) ?? 'Unknown';
        const entrant = entrants.find(e => e.id === session.entrantId);
        
        // Only show room number in session cell if judges are visiting groups
        const roomNumber = settings.moving === 'judges' ? entrant?.roomNumber : null;
        
        if (entrant && entrant.judgePreference1 === judge.id) {
          entrantName = `*${entrantName}`;
        }

        const sessionCellHeightPx = rowSpan * SLOT_ROW_PX;
        const durationParts: string[] = [];
        if (roomNumber) durationParts.push(roomNumber);
        if (session.type !== '3x10') durationParts.push(session.type);
        const durationContent = durationParts.join('<br>');
        const durationBlock = durationContent ? `<br><span class="session-duration">${durationContent}</span>` : '';
        html += `<td class="session-cell" rowspan="${rowSpan}" style="height:${sessionCellHeightPx}px;min-height:${sessionCellHeightPx}px"><span class="session-entrant-name">${entrantName}</span>${durationBlock}</td>`;
        
        // Mark cells as occupied
        for (let r = 0; r < rowSpan; r++) {
          cellOccupied[rowIndex + r][cellIndex] = true;
        }
      } else {
        html += `<td></td>`;
      }
    });
    
    html += `</tr>`;
  });

  html += `
      </tbody>
    </table>
    <div style="margin-top: 20px; font-size: 12px; color: #808080; text-align: center;">
      Generated on ${new Date().toLocaleString()}
      <br>
      -
    </div>
  `;

  // Convert HTML to PDF
  const element = document.createElement('div');
  element.innerHTML = html;
  document.body.appendChild(element);

  const opt = {
    margin: [0.5, 0.5, 0.5, 0.5] as [number, number, number, number], // Increased bottom margin to 1 inch
    filename: 'schedule-matrix.pdf',
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in' as const, format: 'legal' as const, orientation: 'landscape' as const }
  };

  const blob = await html2pdf().set(opt).from(element).outputPdf('blob');
  
  document.body.removeChild(element);
  
  return blob;
}
