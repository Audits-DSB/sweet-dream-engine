export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const BOM = "\uFEFF";
  const csvContent = [
    headers.join(","),
    ...rows.map(row =>
      row.map(cell => {
        const str = String(cell ?? "");
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(",")
    ),
  ].join("\n");

  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
