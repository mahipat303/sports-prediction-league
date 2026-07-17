"use client";

import { useState, useTransition } from "react";
import { Upload, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { importExcel } from "@/app/admin/actions";
import type { ImportResult } from "@/lib/excel-import";

export function ImportForm() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      setResult(await importExcel(formData));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-4 w-4" /> Import Excel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary hover:bg-accent/30">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">
              {fileName ?? "Click to choose an .xlsx file"}
            </span>
            <span className="text-xs text-muted-foreground">
              Teams, players, auction prices, sports, assignments & fixtures
            </span>
            <input
              type="file"
              name="file"
              accept=".xlsx,.xls"
              className="hidden"
              required
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </label>
          <Button type="submit" disabled={pending || !fileName} className="w-full">
            {pending ? "Importing…" : "Validate & Import"}
          </Button>
        </form>

        {result && (
          <div className="space-y-2">
            {result.ok ? (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Import successful
                  </p>
                  <p className="text-muted-foreground">
                    {Object.entries(result.counts)
                      .map(([k, v]) => `${v} ${k}`)
                      .join(" · ") || "Nothing to import"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">
                <p className="mb-1 flex items-center gap-2 font-semibold text-red-600 dark:text-red-400">
                  <XCircle className="h-4 w-4" /> Import failed — nothing was written
                </p>
                <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                  {result.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <p className="mb-1 flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" /> Warnings
                </p>
                <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                  {result.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
