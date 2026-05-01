import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Build rows for a single semester's PDF table.
 * Returns array of arrays for autotable body.
 */
function buildSemesterRows(semester, marks) {
  const safeMarks = marks || {};
  const rows = [];
  for (const subj of semester.subjects) {
    // Determine display name for electives
    let displayName = subj.name;
    let displayCode = subj.code;
    if (subj.isElective) {
      const electiveKey = `${subj.code}_elective`;
      const selected = safeMarks[electiveKey];
      if (selected && selected.code && selected.name) {
        displayCode = selected.code;
        displayName = `${selected.name} (Elective ${subj.electiveGroup})`;
      }
    }

    if (subj.examType === 'Theory') {
      const m = safeMarks[`${subj.code}_theory`] || {};
      const asst = m.asst === '' || m.asst === undefined ? '' : Number(m.asst);
      const fin = m.final === '' || m.final === undefined ? '' : Number(m.final);
      let total = '';
      if (asst !== '' || fin !== '') {
        const asstVal = asst === '' ? 0 : asst;
        const finVal = fin === '' ? 0 : fin;
        const passFinal = Math.ceil(subj.theoryFinal * 0.4);
        if (subj.theoryFinal > 0 && passFinal > 0 && finVal < passFinal) {
          total = '*';
        } else {
          total = asstVal + finVal;
        }
      }
      rows.push([
        displayCode,
        displayName,
        subj.theoryAsst || '—',
        subj.theoryFinal || '—',
        Math.ceil(subj.theoryAsst * 0.4) || '—',
        subj.theoryFinal > 0 ? Math.ceil(subj.theoryFinal * 0.4) : '—',
        asst !== '' ? asst : '',
        fin !== '' ? fin : '',
        total,
      ]);
    } else if (subj.examType === 'Practical') {
      const m = safeMarks[`${subj.code}_practical`] || {};
      const asst = m.asst === '' || m.asst === undefined ? '' : Number(m.asst);
      const fin = m.final === '' || m.final === undefined ? '' : Number(m.final);
      let total = '';
      if (asst !== '' || fin !== '') {
        const asstVal = asst === '' ? 0 : asst;
        const finVal = fin === '' ? 0 : fin;
        const passFinal = subj.practicalFinal > 0 ? Math.ceil(subj.practicalFinal * 0.4) : 0;
        if (subj.practicalFinal > 0 && passFinal > 0 && finVal < passFinal) {
          total = '*';
        } else {
          total = asstVal + finVal;
        }
      }
      rows.push([
        displayCode,
        displayName,
        subj.practicalAsst || '—',
        subj.practicalFinal || '—',
        subj.practicalAsst > 0 ? Math.ceil(subj.practicalAsst * 0.4) : '—',
        subj.practicalFinal > 0 ? Math.ceil(subj.practicalFinal * 0.4) : '—',
        asst !== '' ? asst : '',
        fin !== '' ? fin : '',
        total,
      ]);
    } else if (subj.examType === 'Both') {
      // Theory row
      const mt = safeMarks[`${subj.code}_theory`] || {};
      const tAsst = mt.asst === '' || mt.asst === undefined ? '' : Number(mt.asst);
      const tFin = mt.final === '' || mt.final === undefined ? '' : Number(mt.final);
      let tTotal = '';
      if (tAsst !== '' || tFin !== '') {
        const aVal = tAsst === '' ? 0 : tAsst;
        const fVal = tFin === '' ? 0 : tFin;
        const passFinal = Math.ceil(subj.theoryFinal * 0.4);
        if (subj.theoryFinal > 0 && passFinal > 0 && fVal < passFinal) {
          tTotal = '*';
        } else {
          tTotal = aVal + fVal;
        }
      }
      rows.push([
        displayCode,
        displayName,
        subj.theoryAsst || '—',
        subj.theoryFinal || '—',
        Math.ceil(subj.theoryAsst * 0.4) || '—',
        subj.theoryFinal > 0 ? Math.ceil(subj.theoryFinal * 0.4) : '—',
        tAsst !== '' ? tAsst : '',
        tFin !== '' ? tFin : '',
        tTotal,
      ]);

      // Practical row
      const mp = safeMarks[`${subj.code}_practical`] || {};
      const pAsst = mp.asst === '' || mp.asst === undefined ? '' : Number(mp.asst);
      const pFin = mp.final === '' || mp.final === undefined ? '' : Number(mp.final);
      let pTotal = '';
      if (pAsst !== '' || pFin !== '') {
        const aVal = pAsst === '' ? 0 : pAsst;
        const fVal = pFin === '' ? 0 : pFin;
        const passFinal = subj.practicalFinal > 0 ? Math.ceil(subj.practicalFinal * 0.4) : 0;
        if (subj.practicalFinal > 0 && passFinal > 0 && fVal < passFinal) {
          pTotal = '*';
        } else {
          pTotal = aVal + fVal;
        }
      }
      const practicalName = subj.isElective
        ? `${displayName.replace(` (Elective ${subj.electiveGroup})`, '')} PRACTICAL (Elective ${subj.electiveGroup})`
        : `${displayName}  PRACTICAL`;
      rows.push([
        displayCode,
        practicalName,
        subj.practicalAsst || '—',
        subj.practicalFinal || '—',
        subj.practicalAsst > 0 ? Math.ceil(subj.practicalAsst * 0.4) : '—',
        subj.practicalFinal > 0 ? Math.ceil(subj.practicalFinal * 0.4) : '—',
        pAsst !== '' ? pAsst : '',
        pFin !== '' ? pFin : '',
        pTotal,
      ]);
    }
  }
  return rows;
}

/**
 * Compute summary totals for a semester
 */
export function computeTotals(semester, marks) {
  const safeMarks = marks || {};
  let obtained = 0;
  let possible = 0;
  let hasAny = false;

  for (const subj of semester.subjects) {
    if (subj.examType === 'Theory' || subj.examType === 'Both') {
      possible += subj.theoryAsst + subj.theoryFinal;
      const m = safeMarks[`${subj.code}_theory`] || {};
      if (m.asst !== '' && m.asst !== undefined) { obtained += Number(m.asst); hasAny = true; }
      if (m.final !== '' && m.final !== undefined) {
        const passFinal = Math.ceil(subj.theoryFinal * 0.4);
        const finVal = Number(m.final);
        if (!(subj.theoryFinal > 0 && passFinal > 0 && finVal < passFinal)) {
          obtained += finVal;
        }
        hasAny = true;
      }
    }
    if (subj.examType === 'Practical' || subj.examType === 'Both') {
      possible += subj.practicalAsst + subj.practicalFinal;
      const m = safeMarks[`${subj.code}_practical`] || {};
      if (m.asst !== '' && m.asst !== undefined) { obtained += Number(m.asst); hasAny = true; }
      if (m.final !== '' && m.final !== undefined) {
        const passFinal = subj.practicalFinal > 0 ? Math.ceil(subj.practicalFinal * 0.4) : 0;
        const finVal = Number(m.final);
        if (!(subj.practicalFinal > 0 && passFinal > 0 && finVal < passFinal)) {
          obtained += finVal;
        }
        hasAny = true;
      }
    }
  }

  return {
    obtained: hasAny ? obtained : '—',
    possible,
    percentage: hasAny ? ((obtained / possible) * 100).toFixed(2) + '%' : '—',
  };
}

/**
 * Add a semester table to the PDF document
 */
function addSemesterToPDF(doc, semester, marks, startY, aggregateStr) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.text('TRIBHUVAN UNIVERSITY', pageWidth / 2, startY, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('times', 'normal');
  doc.text('Institute of Engineering — Examination Branch', pageWidth / 2, startY + 6, { align: 'center' });
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text(`${semester.name.toUpperCase()} MARK SHEET`, pageWidth / 2, startY + 13, { align: 'center' });

  const tableRows = buildSemesterRows(semester, marks);
  const head = [
    [
      { content: 'Code', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Title', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
      { content: 'Full Marks', colSpan: 2, styles: { halign: 'center' } },
      { content: 'Pass Marks', colSpan: 2, styles: { halign: 'center' } },
      { content: 'Marks Obtained', colSpan: 2, styles: { halign: 'center' } },
      { content: 'Total', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
    ],
    ['Asst.', 'Final', 'Asst.', 'Final', 'Asst.', 'Final'],
  ];

  autoTable(doc, {
    head: head,
    body: tableRows,
    startY: startY + 17,
    theme: 'grid',
    styles: {
      font: 'times',
      fontSize: 9,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 55 },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 16, halign: 'center' },
      7: { cellWidth: 16, halign: 'center' },
      8: { cellWidth: 16, halign: 'center' },
    },
    didParseCell: function (data) {
      // Highlight failed cells
      if (data.section === 'body' && data.column.index === 8) {
        if (data.cell.raw === '*') {
          data.cell.styles.textColor = [220, 0, 0];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Summary below table
  const totals = computeTotals(semester, marks);
  const finalY = doc.lastAutoTable.finalY + 5;
  doc.setFontSize(9);
  doc.setFont('times', 'normal');
  doc.text(`Total Obtained: ${totals.obtained}  |  Total Marks: ${totals.possible}  |  Semester Percentage: ${totals.percentage}`, 14, finalY);
  
  if (aggregateStr) {
    doc.setFont('times', 'bold');
    doc.text(`Overall IOE Aggregate: ${aggregateStr}`, 14, finalY + 6);
    doc.setFont('times', 'normal');
    doc.text('* = Failed (below pass marks)    — = Not applicable', 14, finalY + 12);
    return finalY + 15;
  } else {
    doc.text('* = Failed (below pass marks)    — = Not applicable', 14, finalY + 5);
    return finalY + 10;
  }
}

/**
 * Export a single semester as PDF
 */
export function exportSemesterPDF(semester, marks, aggregateStr) {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  addSemesterToPDF(doc, semester, marks, 15, aggregateStr);
  doc.save(`IOE_Marksheet_${semester.name.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Export all semesters as a single PDF
 */
export function exportAllSemestersPDF(semesterData, allMarks, aggregateStr) {
  const doc = new jsPDF('landscape', 'mm', 'a4');

  for (let sem = 1; sem <= 8; sem++) {
    if (sem > 1) {
      doc.addPage();
    }
    const semester = semesterData[sem];
    const marks = allMarks[sem] || {};
    addSemesterToPDF(doc, semester, marks, 15, aggregateStr);
  }

  doc.save('IOE_Marksheet_All_Semesters.pdf');
}
