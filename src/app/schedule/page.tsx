import { CalendarDays, CheckCircle2, Clock, Radio, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScheduleFilters } from "@/components/schedule-filters";

export const dynamic = "force-dynamic";

// The office runs on IST; the server may run in UTC (Vercel), so all
// date/time rendering and grouping on this page pins the timezone.
const TZ = "Asia/Kolkata";

function dayKey(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // yyyy-mm-dd
}
function dayLabel(d: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}
function timeLabel(d: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

type DisplayStatus = "upcoming" | "live" | "completed" | "cancelled";

function displayStatus(status: string): DisplayStatus {
  if (status === "LIVE") return "live";
  if (status === "COMPLETED") return "completed";
  if (status === "CANCELLED") return "cancelled";
  return "upcoming"; // SCHEDULED and LOCKED both read as upcoming here
}

const STATUS_META: Record<DisplayStatus, { label: string; variant: "success" | "warning" | "live" | "destructive" | "secondary" }> = {
  upcoming: { label: "🟢 Upcoming", variant: "secondary" },
  live: { label: "🟡 Live", variant: "live" },
  completed: { label: "✅ Completed", variant: "success" },
  cancelled: { label: "❌ Cancelled", variant: "destructive" },
};

type Search = {
  date?: string;
  sport?: string;
  category?: string;
  team?: string;
  status?: string;
  q?: string;
};

export default async function SchedulePage(props: { searchParams: Promise<Search> }) {
  const sp = await props.searchParams;
  const q = (sp.q ?? "").toLowerCase().trim();

  const [fixtures, teams] = await Promise.all([
    prisma.fixture.findMany({
      include: { sport: true, side1Team: true, side2Team: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
  ]);

  const sports = [...new Set(fixtures.map((f) => f.sport.name))].sort();
  const categories = [...new Set(fixtures.map((f) => f.matchCategory))].sort();
  const dates = [...new Map(fixtures.map((f) => [dayKey(f.startTime), dayLabel(f.startTime)])).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, label]) => ({ value, label }));

  const filtered = fixtures.filter((f) => {
    if (sp.date && dayKey(f.startTime) !== sp.date) return false;
    if (sp.sport && f.sport.name !== sp.sport) return false;
    if (sp.category && f.matchCategory !== sp.category) return false;
    if (sp.team && f.side1TeamId !== sp.team && f.side2TeamId !== sp.team) return false;
    if (sp.status && displayStatus(f.status) !== sp.status) return false;
    if (
      q &&
      ![f.side1Label, f.side2Label, f.sport.name, f.side1Team?.name ?? "", f.side2Team?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    )
      return false;
    return true;
  });

  // Group by IST day, preserving chronological order
  const days: { key: string; label: string; matches: typeof filtered }[] = [];
  for (const f of filtered) {
    const key = dayKey(f.startTime);
    let day = days.find((d) => d.key === key);
    if (!day) {
      day = { key, label: dayLabel(f.startTime), matches: [] };
      days.push(day);
    }
    day.matches.push(f);
  }

  const stats = [
    { label: "Total Matches", value: fixtures.length, icon: CalendarDays },
    { label: "Completed", value: fixtures.filter((f) => f.status === "COMPLETED").length, icon: CheckCircle2 },
    { label: "Upcoming", value: fixtures.filter((f) => displayStatus(f.status) === "upcoming").length, icon: Clock },
    { label: "Live Now", value: fixtures.filter((f) => f.status === "LIVE").length, icon: Radio },
  ];

  function SideName({ f, n }: { f: (typeof fixtures)[number]; n: 1 | 2 }) {
    const label = n === 1 ? f.side1Label : f.side2Label;
    const team = n === 1 ? f.side1Team : f.side2Team;
    const isWinner = f.status === "COMPLETED" && f.winnerSide === n;
    const isLoser = f.status === "COMPLETED" && f.winnerSide != null && f.winnerSide !== n;
    return (
      <span className={cn("inline-flex items-center gap-1", isLoser && "opacity-60")}>
        {team && (
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
        )}
        <span className={cn(isWinner && "font-semibold")}>{label}</span>
        {isLoser && <span className="text-xs">😅</span>}
      </span>
    );
  }

  function WinnerCell({ f }: { f: (typeof fixtures)[number] }) {
    if (f.status !== "COMPLETED" || !f.winnerSide) {
      return <span className="text-muted-foreground">—</span>;
    }
    const label = f.winnerSide === 1 ? f.side1Label : f.side2Label;
    const team = f.winnerSide === 1 ? f.side1Team : f.side2Team;
    return (
      <span
        className="inline-flex items-center gap-1 font-semibold"
        style={team ? { color: team.color } : undefined}
      >
        <Trophy className="h-3.5 w-3.5 text-amber-500" /> {label}
      </span>
    );
  }

  function WatchLive({ f, small }: { f: (typeof fixtures)[number]; small?: boolean }) {
    if (!f.liveUrl || f.status === "COMPLETED" || f.status === "CANCELLED") return null;
    return (
      <a href={f.liveUrl} target="_blank" rel="noopener noreferrer">
        <Button size="sm" className={cn("gap-1.5 bg-red-600 text-white hover:bg-red-700", small && "h-7 px-2 text-xs")}>
          <Radio className="h-3.5 w-3.5 animate-pulse" /> Watch Live
        </Button>
      </a>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CalendarDays className="h-6 w-6 text-primary" /> Match Schedule
        </h1>
        <p className="text-sm text-muted-foreground">
          The full tournament at a glance — timings, results, and live matches.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ScheduleFilters
        dates={dates}
        sports={sports}
        categories={categories}
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
      />

      {days.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No matches found for these filters. 🔍
          </CardContent>
        </Card>
      )}

      {days.map((day, dayIdx) => (
        <section key={day.key} className="animate-in-up" style={{ animationDelay: `${dayIdx * 60}ms` }}>
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
            📅 {day.label}
            <span className="text-xs font-normal text-muted-foreground">
              {day.matches.length} match{day.matches.length === 1 ? "" : "es"}
            </span>
          </h2>

          {/* Desktop: table */}
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="p-3 pl-5">Time</th>
                      <th className="p-3">Sport</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Match</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 pr-5">Winner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.matches.map((f) => {
                      const st = STATUS_META[displayStatus(f.status)];
                      return (
                        <tr key={f.id} className="border-b border-border/30 transition-colors last:border-0 hover:bg-accent/40">
                          <td className="whitespace-nowrap p-3 pl-5 font-mono text-xs">{timeLabel(f.startTime)}</td>
                          <td className="whitespace-nowrap p-3">{f.sport.icon} {f.sport.name}</td>
                          <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                            {f.matchCategory}
                            {f.stage && <span className="block text-[10px]">{f.stage}</span>}
                          </td>
                          <td className="p-3">
                            <SideName f={f} n={1} /> <span className="text-xs text-muted-foreground">vs</span>{" "}
                            <SideName f={f} n={2} />
                            {f.scoreSummary && (
                              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{f.scoreSummary}</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="flex items-center gap-2">
                              <Badge variant={st.variant}>{st.label}</Badge>
                              <WatchLive f={f} small />
                            </span>
                          </td>
                          <td className="whitespace-nowrap p-3 pr-5"><WinnerCell f={f} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile: stacked cards */}
          <div className="space-y-3 sm:hidden">
            {day.matches.map((f) => {
              const st = STATUS_META[displayStatus(f.status)];
              return (
                <Card key={f.id}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-semibold">{timeLabel(f.startTime)}</span>
                      <Badge variant="secondary">{f.sport.icon} {f.sport.name}</Badge>
                      <Badge variant="outline">{f.matchCategory}</Badge>
                      <Badge variant={st.variant} className="ml-auto">{st.label}</Badge>
                    </div>
                    <p className="text-sm">
                      <SideName f={f} n={1} /> <span className="text-xs text-muted-foreground">vs</span>{" "}
                      <SideName f={f} n={2} />
                    </p>
                    {f.scoreSummary && (
                      <p className="font-mono text-xs text-muted-foreground">{f.scoreSummary}</p>
                    )}
                    {f.status === "COMPLETED" && f.winnerSide && (
                      <p className="text-sm"><WinnerCell f={f} /></p>
                    )}
                    <WatchLive f={f} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
