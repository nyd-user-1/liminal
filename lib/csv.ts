// Tiny CSV serializer + browser download for TABLE STANDARD v2 export. Pure and
// dependency-free: callers map their typed rows to string/number cells, so the
// export carries the honest stored values (not the rendered badges/links). Not a
// UI primitive — a client-side helper the DataTable's `onExport` hook calls.

export function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const esc = (v: string | number) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>): void {
  const blob = new Blob([toCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
