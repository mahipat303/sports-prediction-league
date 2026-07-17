"use client";

import { useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime } from "@/lib/utils";

export interface InsightRow {
  userName: string;
  userEmail: string;
  side: number;
  prediction: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  time: string; // ISO
}

export interface MatchInsight {
  id: string;
  sportName: string;
  sportIcon: string | null;
  matchCategory: string;
  stage: string | null;
  status: string;
  side1Label: string;
  side2Label: string;
  side1Color: string | null;
  side2Color: string | null;
  total: number;
  dist: { side1: number; side2: number };
  conf: { LOW: number; MEDIUM: number; HIGH: number };
  rows: InsightRow[]; // already filtered
}

const CONF_BADGE: Record<string, { label: string; className: string }> = {
  LOW: { label: "🟢 Low", className: "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  MEDIUM: { label: "🟡 Medium", className: "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  HIGH: { label: "🔴 High", className: "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400" },
};

const STATUS_VARIANT: Record<string, "secondary" | "warning" | "live" | "success" | "destructive"> = {
  SCHEDULED: "secondary",
  LOCKED: "warning",
  LIVE: "live",
  COMPLETED: "success",
  CANCELLED: "destructive",
};

function Bar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-xs">
        <span className="truncate font-medium">{label}</span>
        <span className="text-muted-foreground">{count} · {pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function PredictionInsightCard({ match }: { match: MatchInsight }) {
  const [open, setOpen] = useState(false);
  const c1 = match.side1Color ?? "#6366f1";
  const c2 = match.side2Color ?? "#ec4899";

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">{match.sportIcon ?? "🏅"} {match.sportName}</Badge>
          <Badge variant="outline">{match.matchCategory}</Badge>
          {match.stage && <Badge variant="outline">{match.stage}</Badge>}
          <Badge variant={STATUS_VARIANT[match.status] ?? "secondary"}>{match.status}</Badge>
          <span className="ml-auto flex items-center gap-1 text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> {match.total} prediction{match.total === 1 ? "" : "s"}
          </span>
        </div>

        <p className="mt-2 font-semibold">
          {match.side1Label} <span className="text-muted-foreground">vs</span> {match.side2Label}
        </p>

        {match.total > 0 ? (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Distribution</p>
                <Bar label={match.side1Label} count={match.dist.side1} total={match.total} color={c1} />
                <Bar label={match.side2Label} count={match.dist.side2} total={match.total} color={c2} />
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Confidence</p>
                <Bar label="🔴 High" count={match.conf.HIGH} total={match.total} color="#ef4444" />
                <Bar label="🟡 Medium" count={match.conf.MEDIUM} total={match.total} color="#f59e0b" />
                <Bar label="🟢 Low" count={match.conf.LOW} total={match.total} color="#10b981" />
              </div>
            </div>

            <button
              onClick={() => setOpen((o) => !o)}
              className="mt-3 flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
              {open ? "Hide" : "Show"} {match.rows.length} prediction{match.rows.length === 1 ? "" : "s"}
            </button>

            {open && (
              <div className="mt-2 overflow-x-auto rounded-xl border border-border/50">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="p-2.5 pl-4">User</th>
                      <th className="p-2.5">Prediction</th>
                      <th className="p-2.5">Confidence</th>
                      <th className="p-2.5 pr-4">Prediction time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {match.rows.map((r, i) => (
                      <tr key={i} className="border-b border-border/30 last:border-0">
                        <td className="p-2.5 pl-4">
                          <p className="font-medium">{r.userName}</p>
                          <p className="text-xs text-muted-foreground">{r.userEmail}</p>
                        </td>
                        <td className="p-2.5">
                          <span
                            className="rounded-md px-2 py-0.5 text-xs font-semibold"
                            style={{ backgroundColor: `${(r.side === 1 ? c1 : c2)}22`, color: r.side === 1 ? c1 : c2 }}
                          >
                            {r.prediction}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <Badge variant="outline" className={CONF_BADGE[r.confidence].className}>
                            {CONF_BADGE[r.confidence].label}
                          </Badge>
                        </td>
                        <td className="p-2.5 pr-4 text-muted-foreground">{formatDateTime(r.time)}</td>
                      </tr>
                    ))}
                    {match.rows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-xs text-muted-foreground">
                          No predictions match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No predictions placed yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
