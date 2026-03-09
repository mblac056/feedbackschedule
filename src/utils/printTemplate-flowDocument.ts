import jsPDF from 'jspdf';
import { formatTimeForDisplay } from './printHelpers';

export interface FlowDocumentEntry {
  time: string;
  events: string[];
}

export function generateFlowDocumentPage(doc: jsPDF, flowDocument: FlowDocumentEntry[]) {
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Flow Document', 20, 20);
  
  let yPos = 40;
  const leftMargin = 20;
  const eventIndent = 25;
  const rightMargin = 20;
  const maxY = 250;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  flowDocument.forEach(timeSlot => {
    // Check if we need a new page
    if (yPos > maxY) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.text(formatTimeForDisplay(timeSlot.time), leftMargin, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    timeSlot.events.forEach(event => {
      const wrappedEventLines = doc.splitTextToSize(
        `  ${event}`,
        doc.internal.pageSize.getWidth() - eventIndent - rightMargin
      ) as string[];

      wrappedEventLines.forEach((line) => {
        if (yPos > maxY) {
          doc.addPage();
          yPos = 20;
        }

        doc.text(line, eventIndent, yPos);
        yPos += 6;
      });

      if (wrappedEventLines.length === 0) {
        if (yPos > maxY) {
          doc.addPage();
          yPos = 20;
        }
        yPos += 6;
      }
    });
    yPos += 5;
  });
}



