function escapeCell(cell: string | number): string {
  const str = String(cell ?? "");
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const BOM = "\uFEFF";
  const csvContent = [
    headers.map(escapeCell).join(","),
    ...rows.map(row => row.map(escapeCell).join(",")),
  ].join("\n");

  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportMultiSectionCsv(filename: string, sections: { title: string; headers: string[]; rows: (string | number)[][] }[]) {
  const BOM = "\uFEFF";
  const parts: string[] = [];
  for (const section of sections) {
    parts.push(escapeCell(section.title));
    parts.push(section.headers.map(escapeCell).join(","));
    for (const row of section.rows) {
      parts.push(row.map(escapeCell).join(","));
    }
    parts.push("");
  }
  const csvContent = parts.join("\n");

  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
