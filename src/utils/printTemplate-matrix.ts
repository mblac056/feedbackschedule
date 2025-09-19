import type { Judge, SessionBlock, Entrant } from '../types';
import { getSettings } from './localStorage';
import { getSessionDurationMinutes, TIME_CONFIG } from '../config/timeConfig';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateMatrixPage(
  doc: jsPDF,
  scheduledSessions: SessionBlock[],
  judges: Judge[],
  entrants: Entrant[]
) {
  // 1) Page + title (document already created as legal landscape)
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Schedule Matrix', 20, 20);

  // 2) Build time grid (5-minute rows) from earliest start to latest end
  const settings = getSettings();
  const getSessionDuration = (t: string) => getSessionDurationMinutes(t as '1xLong' | '3x20' | '3x10', settings);
  
  // Helper function to convert row index to time string
  const rowIndexToTime = (rowIndex: number): string => {
    const startTime = settings.startTime;
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const totalMinutes = startMinute + (rowIndex * TIME_CONFIG.MINUTES_PER_SLOT);
    const hour = startHour + Math.floor(totalMinutes / 60);
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

  // 3) Table shape: first column = Time, then one column per Judge
  const headers = ['Time', ...judges.map((j) => j.category ? `${j.name} (${j.category})` : j.name)];
  const colCount = headers.length;
  const timeColIndex = 0;

  // 4) Prepare a body matrix with one row per 5-min slot
  //    We'll later inject rowSpan cells for the sessions, and mark covered cells as null.
  type Cell = string | { content: string; rowSpan?: number; styles?: Record<string, unknown>; fillColor?: number[] } | null;
  const body: Cell[][] = intervals.map((t) => {
    const baseRow: Cell[] = new Array(colCount).fill('');
    baseRow[timeColIndex] = t;
    return baseRow;
  });

  // quick lookup helpers
  const judgeColIndexById = new Map<string, number>();
  judges.forEach((j, idx) => judgeColIndexById.set(j.id, idx + 1));
  const entrantNameById = new Map(entrants.map((e) => [e.id, e.name]));
  
  // 5) Place sessions as merged cells (rowSpan across 5-min rows)
  //    If a session overlaps an already-placed block in the same judge column, mark it as a conflict.
  for (const ss of scheduledSessions) {
    const judgeCol = judgeColIndexById.get(ss.judgeId!);
    if (judgeCol == null) continue;

    const dur = getSessionDuration(ss.type);
    const startRowIndex = ss.startRowIndex!;
    const endRowIndex = startRowIndex + Math.ceil(dur / TIME_CONFIG.MINUTES_PER_SLOT) - 1;

    // Convert row indices to matrix row positions
    const startRow = startRowIndex - minRow;
    const endRow = endRowIndex - minRow;
    
    // Skip if session is outside our matrix range
    if (startRow < 0 || endRow >= intervals.length) continue;

    const span = endRow - startRow + 1;
    const entrantName = entrantNameById.get(ss.entrantId) ?? 'Unknown';
    
    // Get room information based on movement setting
    const entrant = entrants.find(e => e.id === ss.entrantId);
    const judge = judges.find(j => j.id === ss.judgeId);
    const roomNumber = settings.moving === 'judges' ? entrant?.roomNumber : judge?.roomNumber;
    const roomText = roomNumber ? `\nRoom ${roomNumber}` : '';

    // Top cell with rowSpan; others set to null (so autotable knows the area is covered)
    body[startRow][judgeCol] = {
      content: `${entrantName}\n(${ss.type})${roomText}`,
      rowSpan: span,
      styles: {
        halign: 'center',
        valign: 'middle',
        fontSize: 8,
        cellPadding: 2,
        textColor: [0, 0, 0],
      },
      fillColor: [232, 244, 253],
    };

    for (let r = startRow + 1; r <= endRow; r++) {
      body[r][judgeCol] = null; // covered by rowSpan
    }
  }

  // 6) Optional: subtle stripes on time column and every 15-minute line
  const isQuarterHour = (hhmm: string) => ['00', '15', '30', '45'].includes(hhmm.split(':')[1]);

  autoTable(doc, {
    head: [headers],
    body,
    startY: 30,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 1,
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
      0: { fontStyle: 'bold', cellWidth: 20 }, // Time col
    },
    didParseCell: (hookData) => {
      const { section, cell, column } = hookData;
      if (section === 'body') {
        // Shade the time column
        if (column.index === 0) {
          cell.styles.fillColor = [245, 245, 245];
          // bolder every :00/:15/:30/:45
          const t = String(cell.raw ?? '');
          if (isQuarterHour(t)) {
            cell.styles.fontStyle = 'bold';
          }
        }
        // Apply background color for scheduled sessions
        if (column.index > 0 && cell.raw && typeof cell.raw === 'object' && 'fillColor' in cell.raw) {
          cell.styles.fillColor = (cell.raw as { fillColor: [number, number, number] }).fillColor;
        }
        // Center judge columns by default
        if (column.index > 0 && typeof cell.raw === 'string' && cell.raw.trim() === '') {
          // keep blanks white
          cell.styles.fillColor = [255, 255, 255];
        }
      }
    },
    didDrawCell: () => {
      // nothing special; autotable will render rowSpans for us
    },
    // Wider margins on legal landscape
    margin: { top: 30, left: 15, right: 15, bottom: 20 },
    // Let it paginate; header repeats automatically
    pageBreak: 'auto',
  });
}
