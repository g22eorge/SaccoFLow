type Cell = string | number | boolean | null | undefined;

export const toCsv = (headers: string[], rows: Cell[][]) => {
  const escape = (value: Cell) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  };

  const lines = [
    headers.map((header) => escape(header)).join(","),
    ...rows.map((row) => row.map((cell) => escape(cell)).join(",")),
  ];

  return lines.join("\n");
};

const escapePdfText = (value: string) =>
  value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");

export const toSimplePdf = (title: string, headers: string[], rows: Cell[][]) => {
  const lines = [
    title,
    "",
    headers.join(" | "),
    ...rows.map((row) => row.map((cell) => (cell ?? "")).join(" | ")),
  ];

  const maxLines = 60;
  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    visibleLines.push(`... truncated ${lines.length - maxLines} additional lines`);
  }

  const content = [
    "BT",
    "/F1 10 Tf",
    "40 760 Td",
    ...visibleLines.map((line, index) =>
      index === 0
        ? `(${escapePdfText(line)}) Tj`
        : `T* (${escapePdfText(line)}) Tj`,
    ),
    "ET",
  ].join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
};
