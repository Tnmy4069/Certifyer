"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CsvExportButton({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  function download() {
    const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="outline" onClick={download} disabled={rows.length === 0}>
      <Download className="h-4 w-4" />
      Export CSV
    </Button>
  );
}
