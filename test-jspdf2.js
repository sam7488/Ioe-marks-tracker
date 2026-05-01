import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
const doc = new jsPDF();
autoTable(doc, {
  head: [['Test']],
  body: [['Data']]
});
console.log('finalY exists?', doc.lastAutoTable !== undefined);
