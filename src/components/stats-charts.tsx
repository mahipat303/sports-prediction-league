"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadialBarChart, RadialBar, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
            <CardTitle>🎯 Prediction Accuracy by Sport</CardTitle>
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
            <CardTitle>🏅 Accuracy by Category</CardTitle>
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
            <CardTitle>🏆 Team Win Percentage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <RadialBarChart
                innerRadius="25%"
                outerRadius="95%"
                data={teamStats.map((t) => ({ ...t, fill: t.color }))}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar dataKey="winPct" background cornerRadius={8} label={{ fill: "#fff", fontSize: 11, position: "insideStart" }} />
                <Legend
                  formatter={(value, entry) => {
                    const datum = teamStats.find((t) => t.color === (entry as { color?: string }).color);
                    return `${datum?.fullName ?? value} — ${datum?.won ?? 0}/${datum?.played ?? 0} wins`;
                  }}
                />
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
