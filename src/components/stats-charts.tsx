"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadialBarChart, RadialBar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/tooltip";

interface AccuracyDatum {
  name: string;
  accuracy: number;
  predictions: number;
}

interface TeamDatum {
  name: string;
  fullName: string;
  color: string;
  played: number;
  won: number;
  winPct: number;
}

export function StatsCharts({
  sportAccuracy,
  categoryAccuracy,
  teamStats,
}: {
  sportAccuracy: AccuracyDatum[];
  categoryAccuracy: AccuracyDatum[];
  teamStats: TeamDatum[];
}) {
  const hasData = sportAccuracy.length > 0 || teamStats.some((t) => t.played > 0);

  if (!hasData) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Charts will appear once matches are completed and predictions are scored. 📊
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {sportAccuracy.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              🎯 Prediction Accuracy by Sport
              <InfoTip>
                For each sport: (correct predictions ÷ all scored predictions in
                that sport) × 100, across every user. Shows which sports the
                office reads best.
              </InfoTip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={sportAccuracy}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="currentColor" />
                <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 12 }} stroke="currentColor" />
                <Tooltip
                  formatter={(value) => [`${value}%`, "Accuracy"]}
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    color: "var(--foreground)",
                  }}
                />
                <Bar dataKey="accuracy" radius={[6, 6, 0, 0]} fill="#818cf8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {categoryAccuracy.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              🏅 Accuracy by Category
              <InfoTip>
                Same accuracy formula, grouped by match category (Male Singles,
                Mix Double, …): correct ÷ total scored predictions × 100.
              </InfoTip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={categoryAccuracy} layout="vertical">
                <XAxis type="number" unit="%" domain={[0, 100]} tick={{ fontSize: 12 }} stroke="currentColor" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} stroke="currentColor" />
                <Tooltip
                  formatter={(value) => [`${value}%`, "Accuracy"]}
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.75rem",
                    color: "var(--foreground)",
                  }}
                />
                <Bar dataKey="accuracy" radius={[0, 6, 6, 0]}>
                  {categoryAccuracy.map((entry, i) => (
                    <Cell
                      key={entry.name}
                      fill={["#f59e0b", "#818cf8", "#10b981", "#ec4899", "#38bdf8"][i % 5]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {teamStats.some((t) => t.played > 0) && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              🏆 Team Win Percentage
              <InfoTip>
                Matches won ÷ matches played × 100 per team. A team plays a
                match when all players on one side belong to it; matches whose
                sides aren&apos;t linked to a team don&apos;t count here.
              </InfoTip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid items-center gap-4 sm:grid-cols-2">
              {/* Chart */}
              <div className="mx-auto w-full max-w-[280px]">
                <ResponsiveContainer width="100%" height={240}>
                  <RadialBarChart
                    innerRadius="30%"
                    outerRadius="100%"
                    data={[...teamStats]
                      .sort((a, b) => b.winPct - a.winPct)
                      .map((t) => ({ ...t, fill: t.color }))}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <RadialBar dataKey="winPct" background cornerRadius={8} label={{ fill: "#fff", fontSize: 11, position: "insideStart" }} />
                    <Tooltip
                      formatter={(value) => [`${value}%`, "Win rate"]}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.75rem",
                        color: "var(--foreground)",
                      }}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>

              {/* Legend / standings list */}
              <div className="space-y-2.5">
                {[...teamStats]
                  .sort((a, b) => b.winPct - a.winPct)
                  .map((t) => (
                    <div key={t.name} className="flex items-center gap-3">
                      <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">{t.fullName}</span>
                          <span className="flex-shrink-0 text-sm font-semibold tabular-nums">{t.winPct}%</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full" style={{ width: `${t.winPct}%`, backgroundColor: t.color }} />
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {t.won} won / {t.played} played
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
