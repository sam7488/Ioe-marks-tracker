import { useMemo } from 'react';

/**
 * MarksheetTable — replicates the IOE transcript look.
 *
 * Props:
 *  - semester: { name, subjects, totalMarks }
 *  - marks: { [rowKey]: { asst: number, final: number } }
 *  - setMarks: state setter
 */
export default function MarksheetTable({ semester, marks, setMarks }) {
  // Get the selected elective info for a subject
  const getElectiveSelection = (subj) => {
    if (!subj.isElective) return null;
    const electiveKey = `${subj.code}_elective`;
    return marks[electiveKey] || null;
  };

  // Handle elective selection
  const handleElectiveChange = (subj, selectedCode) => {
    const electiveKey = `${subj.code}_elective`;
    if (!selectedCode) {
      setMarks((prev) => {
        const next = { ...prev };
        delete next[electiveKey];
        return next;
      });
      return;
    }
    const option = subj.electiveOptions.find((o) => o.code === selectedCode);
    if (option) {
      setMarks((prev) => ({
        ...prev,
        [electiveKey]: { code: option.code, name: option.name },
      }));
    }
  };

  // Expand subjects into display rows (Theory / Practical / Both → 2 rows)
  const rows = useMemo(() => {
    const result = [];
    for (const subj of semester.subjects) {
      // Determine display name for electives
      let displayName = subj.name;
      let displayCode = subj.code;
      const electiveSelection = subj.isElective ? getElectiveSelection(subj) : null;
      if (electiveSelection && electiveSelection.name) {
        displayName = `${electiveSelection.name} (Elective ${subj.electiveGroup})`;
        displayCode = electiveSelection.code;
      }

      if (subj.examType === 'Theory') {
        result.push({
          key: `${subj.code}_theory`,
          code: displayCode,
          title: displayName,
          fullMarksAsst: subj.theoryAsst,
          fullMarksFinal: subj.theoryFinal,
          passMarksAsst: Math.ceil(subj.theoryAsst * 0.4),
          passMarksFinal: Math.ceil(subj.theoryFinal * 0.4),
          type: 'theory',
          subj,
          isElective: !!subj.isElective,
          electiveSelected: !!electiveSelection,
        });
      } else if (subj.examType === 'Practical') {
        result.push({
          key: `${subj.code}_practical`,
          code: displayCode,
          title: displayName,
          fullMarksAsst: subj.practicalAsst,
          fullMarksFinal: subj.practicalFinal,
          passMarksAsst: Math.ceil(subj.practicalAsst * 0.4),
          passMarksFinal: subj.practicalFinal > 0 ? Math.ceil(subj.practicalFinal * 0.4) : 0,
          type: 'practical',
          subj,
          isElective: !!subj.isElective,
          electiveSelected: !!electiveSelection,
        });
      } else if (subj.examType === 'Both') {
        // Theory row
        result.push({
          key: `${subj.code}_theory`,
          code: displayCode,
          title: displayName,
          fullMarksAsst: subj.theoryAsst,
          fullMarksFinal: subj.theoryFinal,
          passMarksAsst: Math.ceil(subj.theoryAsst * 0.4),
          passMarksFinal: Math.ceil(subj.theoryFinal * 0.4),
          type: 'theory',
          subj,
          isElective: !!subj.isElective,
          electiveSelected: !!electiveSelection,
        });
        // Practical row
        const practicalTitle = subj.isElective && electiveSelection
          ? `${electiveSelection.name} PRACTICAL (Elective ${subj.electiveGroup})`
          : `${displayName}  PRACTICAL`;
        result.push({
          key: `${subj.code}_practical`,
          code: displayCode,
          title: practicalTitle,
          fullMarksAsst: subj.practicalAsst,
          fullMarksFinal: subj.practicalFinal,
          passMarksAsst: subj.practicalAsst > 0 ? Math.ceil(subj.practicalAsst * 0.4) : 0,
          passMarksFinal: subj.practicalFinal > 0 ? Math.ceil(subj.practicalFinal * 0.4) : 0,
          type: 'practical',
          subj,
          isElective: !!subj.isElective,
          electiveSelected: !!electiveSelection,
          isPracticalRow: true,
        });
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semester, marks]);

  // Get marks for a row
  const getRowMarks = (key) => marks[key] || { asst: '', final: '' };

  // Update marks for a row
  const updateMark = (row, field, value) => {
    let numVal = value === '' ? '' : Math.max(0, parseInt(value) || 0);
    if (numVal !== '') {
      const maxAllowed = field === 'asst' ? row.fullMarksAsst : row.fullMarksFinal;
      if (numVal > maxAllowed) numVal = maxAllowed;
    }
    setMarks((prev) => ({
      ...prev,
      [row.key]: {
        ...prev[row.key],
        [field]: numVal,
      },
    }));
  };

  // Compute total for a row
  const computeRowTotal = (row) => {
    const m = getRowMarks(row.key);
    const asstEmpty = m.asst === '' || m.asst === undefined || m.asst === null;
    const finEmpty = m.final === '' || m.final === undefined || m.final === null;

    if (asstEmpty && finEmpty) return { total: '', failed: false };

    const finalVal = finEmpty ? 0 : Number(m.final);
    const asstVal = asstEmpty ? 0 : Number(m.asst);

    // Check if final marks are below pass marks (only if there are final marks to check)
    if (row.fullMarksFinal > 0 && row.passMarksFinal > 0 && finalVal < row.passMarksFinal) {
      return { total: '—', failed: true };
    }

    return { total: asstVal + finalVal, failed: false };
  };

  // Check if final mark has asterisk (below pass marks)
  const hasAsterisk = (row) => {
    const m = getRowMarks(row.key);
    const finEmpty = m.final === '' || m.final === undefined || m.final === null;
    if (finEmpty || row.fullMarksFinal === 0) return false;
    const finalVal = Number(m.final);
    return row.passMarksFinal > 0 && finalVal < row.passMarksFinal;
  };

  // Calculate semester totals
  const semesterTotals = useMemo(() => {
    let totalObtained = 0;
    let totalPossible = 0;
    let hasAnyMark = false;

    for (const row of rows) {
      totalPossible += row.fullMarksAsst + row.fullMarksFinal;
      const { total } = computeRowTotal(row);
      if (total !== '' && total !== '—') {
        totalObtained += total;
        hasAnyMark = true;
      } else if (total === '—') {
        hasAnyMark = true;
        // Failed row — still count 0 in total
      }
    }

    return {
      obtained: hasAnyMark ? totalObtained : '—',
      possible: totalPossible,
      percentage: hasAnyMark ? ((totalObtained / totalPossible) * 100).toFixed(2) : '—',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, marks]);

  // Render elective selector dropdown or code text
  const renderCodeCell = (row) => {
    if (!row.isElective || row.isPracticalRow) {
      return row.code;
    }
    const subj = row.subj;
    const electiveKey = `${subj.code}_elective`;
    const selected = marks[electiveKey];
    const selectedCode = selected?.code || '';

    return (
      <div className="relative inline-block w-full" style={{ maxWidth: '100px' }}>
        <select
          value={selectedCode}
          onChange={(e) => handleElectiveChange(subj, e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          title="Select Elective"
        >
          <option value="">{subj.code} ▾</option>
          {subj.electiveOptions.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.code} — {opt.name}
            </option>
          ))}
        </select>
        <div className="flex items-center justify-between text-sm font-bold text-gray-900 py-0.5 px-1 border border-transparent hover:border-gray-300 hover:bg-gray-50 rounded cursor-pointer transition-colors">
          <span className="truncate">{selectedCode || subj.code}</span>
          <svg className="w-4 h-4 text-gray-500 ml-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-300 shadow-sm">
      {/* Title */}
      <div className="border-b border-gray-300 px-6 py-4 text-center">
        <h3 className="text-xl font-bold" style={{ fontFamily: "'Times New Roman', serif" }}>
          TRIBHUVAN UNIVERSITY
        </h3>
        <p className="text-sm mt-1" style={{ fontFamily: "'Times New Roman', serif" }}>
          Institute of Engineering — Examination Branch
        </p>
        <p className="text-sm font-semibold mt-2" style={{ fontFamily: "'Times New Roman', serif" }}>
          {semester.name.toUpperCase()} MARK SHEET
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ fontFamily: "'Times New Roman', serif" }}>
          <thead>
            <tr className="bg-gray-50">
              <th
                rowSpan={2}
                className="border border-gray-400 px-3 py-2 text-left text-sm font-bold"
                style={{ minWidth: '80px' }}
              >
                Code
              </th>
              <th
                rowSpan={2}
                className="border border-gray-400 px-3 py-2 text-left text-sm font-bold"
                style={{ minWidth: '200px' }}
              >
                Title
              </th>
              <th colSpan={2} className="border border-gray-400 px-3 py-1 text-center text-sm font-bold">
                Full Marks
              </th>
              <th colSpan={2} className="border border-gray-400 px-3 py-1 text-center text-sm font-bold">
                Pass Marks
              </th>
              <th colSpan={2} className="border border-gray-400 px-3 py-1 text-center text-sm font-bold">
                Marks Obtained
              </th>
              <th
                rowSpan={2}
                className="border border-gray-400 px-3 py-2 text-center text-sm font-bold"
                style={{ minWidth: '60px' }}
              >
                Total
              </th>
            </tr>
            <tr className="bg-gray-50">
              <th className="border border-gray-400 px-3 py-1 text-center text-sm font-bold" style={{ minWidth: '50px' }}>
                Asst.
              </th>
              <th className="border border-gray-400 px-3 py-1 text-center text-sm font-bold" style={{ minWidth: '50px' }}>
                Final
              </th>
              <th className="border border-gray-400 px-3 py-1 text-center text-sm font-bold" style={{ minWidth: '50px' }}>
                Asst.
              </th>
              <th className="border border-gray-400 px-3 py-1 text-center text-sm font-bold" style={{ minWidth: '50px' }}>
                Final
              </th>
              <th className="border border-gray-400 px-3 py-1 text-center text-sm font-bold" style={{ minWidth: '60px' }}>
                Asst.
              </th>
              <th className="border border-gray-400 px-3 py-1 text-center text-sm font-bold" style={{ minWidth: '60px' }}>
                Final
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const m = getRowMarks(row.key);
              const { total, failed } = computeRowTotal(row);
              const showAsterisk = hasAsterisk(row);

              return (
                <tr key={row.key} className="hover:bg-gray-50 transition-colors">
                  {/* Code */}
                  <td className="border border-gray-400 px-2 py-1 text-sm font-bold">
                    {renderCodeCell(row)}
                  </td>
                  {/* Title */}
                  <td className="border border-gray-400 px-3 py-2 text-sm font-bold">
                    {row.title}
                  </td>
                  {/* Full Marks Asst */}
                  <td className="border border-gray-400 px-3 py-2 text-center text-sm">
                    {row.fullMarksAsst || '—'}
                  </td>
                  {/* Full Marks Final */}
                  <td className="border border-gray-400 px-3 py-2 text-center text-sm">
                    {row.fullMarksFinal || '—'}
                  </td>
                  {/* Pass Marks Asst */}
                  <td className="border border-gray-400 px-3 py-2 text-center text-sm">
                    {row.passMarksAsst || '—'}
                  </td>
                  {/* Pass Marks Final */}
                  <td className="border border-gray-400 px-3 py-2 text-center text-sm">
                    {row.passMarksFinal || '—'}
                  </td>
                  {/* Marks Obtained Asst */}
                  <td className="border border-gray-400 px-2 py-1 text-center">
                    {row.fullMarksAsst > 0 ? (
                      <input
                        type="number"
                        min="0"
                        max={row.fullMarksAsst}
                        value={m.asst}
                        onChange={(e) => updateMark(row, 'asst', e.target.value)}
                        className="w-full text-center text-sm py-1 px-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                        style={{ fontFamily: "'Times New Roman', serif", maxWidth: '60px', margin: '0 auto', display: 'block' }}
                        placeholder="—"
                      />
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  {/* Marks Obtained Final */}
                  <td className="border border-gray-400 px-2 py-1 text-center">
                    {row.fullMarksFinal > 0 ? (
                      <span className="relative inline-block">
                        <input
                          type="number"
                          min="0"
                          max={row.fullMarksFinal}
                          value={m.final}
                          onChange={(e) => updateMark(row, 'final', e.target.value)}
                          className={`w-full text-center text-sm py-1 px-1 border rounded focus:outline-none focus:ring-1 focus:ring-gray-400 ${showAsterisk ? 'border-red-400 bg-red-50' : 'border-gray-300'
                            }`}
                          style={{ fontFamily: "'Times New Roman', serif", maxWidth: '60px', display: 'block' }}
                          placeholder="—"
                        />
                        {showAsterisk && (
                          <span className="absolute -top-1 -right-3 text-red-600 font-bold text-lg">*</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  {/* Total */}
                  <td
                    className={`border border-gray-400 px-3 py-2 text-center text-sm font-bold ${failed ? 'text-red-600' : ''
                      }`}
                  >
                    {total === '' ? '' : total}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      <div className="border-t border-gray-400 px-6 py-4 bg-gray-50">
        <div className="flex flex-wrap items-center justify-between gap-4" style={{ fontFamily: "'Times New Roman', serif" }}>
          <div className="flex items-center gap-6">
            <div>
              <span className="text-sm text-gray-600">Total Obtained: </span>
              <span className="text-lg font-bold">{semesterTotals.obtained}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Total Marks: </span>
              <span className="text-lg font-bold">{semesterTotals.possible}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Percentage: </span>
              <span className="text-lg font-bold">
                {semesterTotals.percentage !== '—' ? `${semesterTotals.percentage}%` : '—'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500" style={{ fontFamily: 'sans-serif' }}>
            <span className="text-red-600 font-bold text-base">*</span>
            <span>= Failed (below pass marks)</span>
            <span className="ml-2 font-bold">—</span>
            <span>= Not applicable / No total</span>
          </div>
        </div>
      </div>
    </div>
  );
}
