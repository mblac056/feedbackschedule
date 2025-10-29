import html2pdf from 'html2pdf.js';
import type { Entrant, Judge, EntrantJudgeAssignments } from '../types';
import { getCategoryColor } from '../config/categoryConfig';

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
  entrantByeLengths?: { [entrantId: string]: number };
}

export async function generatePreferenceCheckPage(data: PreferenceCheckData): Promise<Blob> {
  // Helper function to check if a group has conflicts for a specific entrant
  const hasGroupConflict = (entrantId: string, groupId: string): boolean => {
    if (!data.scheduleConflicts) return false;
    return data.scheduleConflicts.some(conflict => 
      conflict.entrantId === entrantId && conflict.conflictingEntrantId === groupId
    );
  };

  // Filter included entrants
  const includedEntrants = data.entrants.filter(e => e.includeInSchedule);
  
  // Build HTML
  let html = `
    <style>
      body { margin: 0; padding: 20px; font-family: Arial, sans-serif; color: #000; }
      h1 { font-size: 16px; font-weight: bold; margin-bottom: 20px; color: #000; }
      .summary { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
      .summary h3 { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px; }
      .summary-row { display: flex; flex-wrap: wrap; gap: 16px; font-size: 14px; }
      .summary-item { display: flex; align-items: center; gap: 8px; }
      .summary-dot { width: 12px; height: 12px; border-radius: 50%; }
      .summary-dot.green { background: #bbf7d0; }
      .summary-dot.red { background: #fecaca; }
      .summary-dot.gray { background: #e5e7eb; }
      .summary-count { font-weight: 600; }
      .summary-count.green { color: #166534; }
      .summary-count.red { color: #991b1b; }
      .summary-count.gray { color: #1f2937; }
      .summary-label { color: #4b5563; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      th { background-color: #f3f4f6; color: #374151; padding: 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
      td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
      .pill { display: inline-flex; align-items: center; justify-content: center; padding: 2px 8px; border-radius: 9999px; font-size: 10px; margin: 2px; }
      .pill.green { background: #dcfce7; color: #166534; }
      .pill.red { background: #fee2e2; color: #991b1b; }
      .pill.gray { background: #e5e7eb; color: #4b5563; }
      .pill-dot { width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
      .footer { margin-top: 20px; font-size: 8px; color: #808080; text-align: center; }
      @media print {
        @page { size: letter portrait; margin: 0.5in; }
      }
    </style>
    <h1>Preference Check</h1>
    <div class="summary">
      <h3>Summary</h3>
      <div class="summary-row">
        <div class="summary-item">
          <span class="summary-dot green"></span>
          <span class="summary-count green">${data.pillCounts.greenCount}</span>
          <span class="summary-label">Good/Assigned</span>
        </div>
        <div class="summary-item">
          <span class="summary-dot red"></span>
          <span class="summary-count red">${data.pillCounts.redCount}</span>
          <span class="summary-label">Conflicts</span>
        </div>
        <div class="summary-item">
          <span class="summary-dot gray"></span>
          <span class="summary-count gray">${data.pillCounts.grayCount}</span>
          <span class="summary-label">Unassigned/Mismatched</span>
        </div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Name</th>
          <th>Groups to Avoid</th>
          <th>Preference</th>
          <th>Judge 1</th>
          <th>Judge 2</th>
          <th>Judge 3</th>
          <th>Byes</th>
        </tr>
      </thead>
      <tbody>
  `;

  includedEntrants.forEach((entrant, index) => {
    html += '<tr>';
    
    // # column
    html += `<td>${index + 1}</td>`;
    
    // Name column
    html += `<td><span style="font-weight: 600;">${entrant.name}</span></td>`;
    
    // Groups to Avoid column
    html += '<td>';
    if (entrant.groupsToAvoid && entrant.groupsToAvoid.length > 0) {
      entrant.groupsToAvoid.forEach(groupId => {
        const groupEntrant = data.entrants.find(e => e.id === groupId);
        const groupName = groupEntrant?.name || 'Unknown Group';
        const hasConflict = hasGroupConflict(entrant.id, groupId);
        const pillClass = hasConflict ? 'red' : 'green';
        html += `<span class="pill ${pillClass}">${groupName}</span>`;
      });
    }
    html += '</td>';
    
    // Preference column
    html += '<td>';
    if (entrant.preference) {
      const entrantSessionBlocks = data.allSessionBlocks?.filter(block => block.entrantId === entrant.id) || [];
      const hasMatchingSessionType = entrantSessionBlocks.some(block => block.type === entrant.preference);
      const pillClass = hasMatchingSessionType ? 'green' : 'red';
      html += `<span class="pill ${pillClass}">${entrant.preference}</span>`;
    }
    html += '</td>';
    
    // Judge columns
    [entrant.judgePreference1, entrant.judgePreference2, entrant.judgePreference3].forEach(judgeId => {
      html += '<td>';
      if (judgeId) {
        const judge = data.judges.find(j => j.id === judgeId);
        if (judge) {
          const isAssigned = data.entrantJudgeAssignments?.[entrant.id]?.includes(judgeId);
          const pillClass = isAssigned ? 'green' : 'gray';
          const dotColor = judge.category ? getCategoryColor(judge.category) : '';
          html += `<span class="pill ${pillClass}">`;
          if (judge.category) {
            html += `<span class="pill-dot" style="background-color: ${dotColor};"></span>`;
          }
          html += `${judge.name}</span>`;
        }
      }
      html += '</td>';
    });
    
    // Total Byes column
    html += '<td>';
    const byeLength = data.entrantByeLengths?.[entrant.id] ?? 0;
    if (byeLength > 0) {
      const hours = Math.floor(byeLength / 60);
      const minutes = byeLength % 60;
      let byeText = '';
      if (hours > 0) {
        byeText += `${hours}h`;
      }
      if (minutes > 0) {
        byeText += `${hours > 0 ? ' ' : ''}${minutes}m`;
      }
      html += `<span style="font-weight: 600;">${byeText || '0m'}</span>`;
    } else {
      html += '<span style="color: #9ca3af;">-</span>';
    }
    html += '</td>';
    
    html += '</tr>';
  });

  html += `
      </tbody>
    </table>
    <div class="footer">
      Generated on ${new Date().toLocaleString()}
    </div>
  `;

  // Convert HTML to PDF
  const element = document.createElement('div');
  element.innerHTML = html;
  document.body.appendChild(element);

  const opt = {
    margin: [0.5, 0.5, 0.5, 0.5] as [number, number, number, number],
    filename: 'preference-check.pdf',
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const }
  };

  const blob = await html2pdf().set(opt).from(element).outputPdf('blob');
  
  document.body.removeChild(element);
  
  return blob;
}
