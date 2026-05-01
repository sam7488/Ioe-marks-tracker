import { jsPDF } from 'jspdf';
console.log('jsPDF type:', typeof jsPDF);
try {
  const doc = new jsPDF();
  console.log('Successfully created doc');
} catch (e) {
  console.error('Error creating doc:', e.message);
}
