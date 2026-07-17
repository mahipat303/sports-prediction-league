"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Builds and downloads a CSV entirely client-side (no server, no new deps). */
export function InsightsExport({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  function escapeCell(value: string | number): string {
    const s = String(value ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function download() {
    const lines = [headers, ...rows]
      .map((r) => r.map(escapeCell).join(","))
      .join("\n");
    // BOM so Excel opens UTF-8 (emojis, ₹) correctly.
    const blob = new Blob(["﻿" + lines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={download} disabled={rows.length === 0}>
      <Download className="h-4 w-4" /> Export CSV
    </Button>
  );
}
