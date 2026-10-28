import type { Judge, SessionBlock, Entrant } from '../types';
import { getSettings } from './localStorage';
import { getSessionDurationMinutes, TIME_CONFIG, type SessionSettings } from '../config/timeConfig';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function generateMatrixPage(
  scheduledSessions: SessionBlock[],
  judges: Judge[],
  entrants: Entrant[],
  /** When omitted, falls back to creator localStorage settings (keeps /create exports working). */
  settingsOverride?: SessionSettings
): Promise<Blob> {
  const settings = settingsOverride ?? getSettings();
  const getSessionDuration = (t: string) => getSessionDurationMinutes(t as '1xLong' | '3x20' | '3x10', settings);
  const escapeHtml = (text: string): string => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const feedbackRound = settings.exportName?.trim();
  const title = feedbackRound ? `Schedule Matrix - ${escapeHtml(feedbackRound)}` : 'Schedule Matrix';
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
      table { width: 100%; border-collapse: collapse; font-size: 16px; table-layout: fixed; line-height: 1.15; }
      th { background-color: #d3d3d3; color: #000; padding: 8px; text-align: center; font-weight: bold; border: 1px solid #666; }
      tbody tr { height: ${SLOT_ROW_PX}px; }
      td { height: ${SLOT_ROW_PX}px; min-height: ${SLOT_ROW_PX}px; padding: 4px 6px; box-sizing: border-box; background-color:rgb(243, 243, 243); border: 1px solid #000; text-align: center; vertical-align: middle; color: #000; }
      .time-col { line-height: 0.5; padding: 0 0 16px 0; background-color: #d3d3d3; width: 20px; font-size: 12px; vertical-align: top; }
      .session-cell { background-color:#ffffff; padding: 0; position: relative; vertical-align: top; }
      .session-cell-inner { position: absolute; left: 0; right: 0; top: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; padding: 0 4px 12px 4px; line-height: 1; text-align: center; }
      .session-entrant-name { font-size: 14px; line-height: 1.15; }
      .session-duration { font-size: 11px; line-height: 1.15; color: #333; }
      @media print {
        @page { size: letter landscape; margin: 0.4in; }
      }
    </style>
    <h1>${title}</h1>
    <table>
      <thead>
        <tr>
          <th>Time</th>
          ${judges.map(j => {
            const roomText = settings.moving === 'groups' && j.roomNumber ? `<br>${j.roomNumber}` : '';
            return `<th>${j.category ? `${j.name}<br />(${j.category})` : j.name}${roomText}</th>`;
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
        const roomBlock = roomNumber ? `<span class="session-duration">${escapeHtml(roomNumber)}</span>` : '';
        html += `<td class="session-cell" rowspan="${rowSpan}" style="height:${sessionCellHeightPx}px;min-height:${sessionCellHeightPx}px"><div class="session-cell-inner"><span class="session-entrant-name">${escapeHtml(entrantName)}</span>${roomBlock}</div></td>`;
        
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

  // Lay the table out at the printable width, then scale the snapshot so the
  // whole matrix — however many rows or judge columns — fits on one page.
  const marginIn = 0.5;
  const pdf = new jsPDF({ unit: 'in', format: 'letter', orientation: 'landscape' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginIn * 2;
  const maxHeight = pageHeight - marginIn * 2;

  const element = document.createElement('div');
  element.innerHTML = html;
  element.style.width = `${maxWidth}in`;
  element.style.backgroundColor = '#ffffff';
  document.body.appendChild(element);

  try {
    const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const heightAtFullWidth = maxWidth * (canvas.height / canvas.width);
    const fit = heightAtFullWidth > maxHeight ? maxHeight / heightAtFullWidth : 1;
    const drawWidth = maxWidth * fit;
    const drawHeight = heightAtFullWidth * fit;
    const x = marginIn + (maxWidth - drawWidth) / 2;

    pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', x, marginIn, drawWidth, drawHeight);
    return pdf.output('blob');
  } finally {
    document.body.removeChild(element);
  }
}
