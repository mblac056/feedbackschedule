import jsPDF from 'jspdf';
import { formatTimeForDisplay } from './printHelpers';

export interface FlowDocumentEntry {
  time: string;
  events: string[];
}

export function generateFlowDocumentPage(doc: jsPDF, flowDocument: FlowDocumentEntry[], addNewPage: () => void) {
  addNewPage();
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Flow Document', 20, 20);
  
  let yPos = 40;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  flowDocument.forEach(timeSlot => {
    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.text(formatTimeForDisplay(timeSlot.time), 20, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    timeSlot.events.forEach(event => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(`  ${event}`, 25, yPos);
      yPos += 6;
    });
    yPos += 5;
  });
}



