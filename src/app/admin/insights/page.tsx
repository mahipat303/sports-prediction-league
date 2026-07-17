import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { InsightsFilters } from "@/components/insights-filters";
import { ChampionFilters } from "@/components/insights-filters";
import { InsightsExport } from "@/components/insights-export";
import { PredictionInsightCard, type MatchInsight } from "@/components/prediction-insight-card";

export const dynamic = "force-dynamic";

type Search = {
  tab?: string;
  user?: string;
  team?: string;
  sport?: string;
  category?: string;
  confidence?: string;
  status?: string;
  q?: string;
};

export default async function InsightsPage(props: { searchParams: Promise<Search> }) {
  // Defence-in-depth: guard in the page itself (not only the layout), so no
  // prediction data is ever queried or streamed for non-admins.
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const sp = await props.searchParams;
  const tab = sp.tab === "champion" ? "champion" : "matches";

  const [fixtures, teams, tournament, users] = await Promise.all([
    prisma.fixture.findMany({
      include: {
        sport: true,
        side1Team: true,
        side2Team: true,
        predictions: { include: { user: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.tournament.findFirst({
      where: { isActive: true },
      include: {
        championPredictions: {
          include: { user: true, team: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const sports = [...new Set(fixtures.map((f) => f.sport.name))].sort();
  const categories = [...new Set(fixtures.map((f) => f.matchCategory))].sort();
  const q = (sp.q ?? "").toLowerCase().trim();
  const predLevelActive = Boolean(sp.confidence || sp.user || q);

  // ---- Matches tab ----
  const matches: MatchInsight[] = [];
  const matchExport: (string | number)[][] = [];

  for (const f of fixtures) {
    if (sp.sport && f.sport.name !== sp.sport) continue;
    if (sp.category && f.matchCategory !== sp.category) continue;
    if (sp.status && f.status !== sp.status) continue;
    if (sp.team && f.side1TeamId !== sp.team && f.side2TeamId !== sp.team) continue;

    const all = f.predictions;
    const dist = {
      side1: all.filter((p) => p.predictedSide === 1).length,
      side2: all.filter((p) => p.predictedSide === 2).length,
    };
    const conf = {
      LOW: all.filter((p) => p.confidence === "LOW").length,
      MEDIUM: all.filter((p) => p.confidence === "MEDIUM").length,
      HIGH: all.filter((p) => p.confidence === "HIGH").length,
    };

    const rows = all
      .filter((p) => (sp.confidence ? p.confidence === sp.confidence : true))
      .filter((p) => (sp.user ? p.userId === sp.user : true))
      .filter((p) =>
        q ? p.user.name.toLowerCase().includes(q) || p.user.email.toLowerCase().includes(q) : true
      )
      .map((p) => ({
        userName: p.user.name,
        userEmail: p.user.email,
        side: p.predictedSide,
        prediction: p.predictedSide === 1 ? f.side1Label : f.side2Label,
        confidence: p.confidence as "LOW" | "MEDIUM" | "HIGH",
        time: p.createdAt.toISOString(),
      }));

    if (predLevelActive && rows.length === 0) continue;

    matches.push({
      id: f.id,
      sportName: f.sport.name,
      sportIcon: f.sport.icon,
      matchCategory: f.matchCategory,
      stage: f.stage,
      status: f.status,
      side1Label: f.side1Label,
      side2Label: f.side2Label,
      side1Color: f.side1Team?.color ?? null,
      side2Color: f.side2Team?.color ?? null,
      total: all.length,
      dist,
      conf,
      rows,
    });

    for (const r of rows) {
      matchExport.push([
        `${f.side1Label} vs ${f.side2Label}`,
        f.sport.name,
        f.matchCategory,
        f.status,
        r.userName,
        r.userEmail,
        r.prediction,
        r.confidence,
        formatDateTime(r.time),
      ]);
    }
  }

  // ---- Champion tab ----
  const champPreds = tournament?.championPredictions ?? [];
  const champRows = champPreds
    .filter((p) => (sp.user ? p.userId === sp.user : true))
    .filter((p) => (sp.team ? p.teamId === sp.team : true))
    .filter((p) =>
      q ? p.user.name.toLowerCase().includes(q) || p.user.email.toLowerCase().includes(q) : true
    );
  const champByTeam = teams
    .map((t) => ({ team: t, count: champPreds.filter((p) => p.teamId === t.id).length }))
    .sort((a, b) => b.count - a.count);
  const champTotal = champPreds.length;
  const champExport: (string | number)[][] = champRows.map((p) => [
    p.user.name,
    p.user.email,
    p.team.name,
    formatDateTime(p.createdAt.toISOString()),
  ]);

  const totalMatchPreds = fixtures.reduce((s, f) => s + f.predictions.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">🔍 Prediction Insights</h2>
          <p className="text-sm text-muted-foreground">
            Admin-only view of who predicted what. {totalMatchPreds} match prediction
            {totalMatchPreds === 1 ? "" : "s"} · {champTotal} champion pick{champTotal === 1 ? "" : "s"}.
          </p>
        </div>
        {tab === "matches" ? (
          <InsightsExport
            filename="match-predictions.csv"
            headers={["Match", "Sport", "Category", "Status", "User", "Email", "Prediction", "Confidence", "Prediction Time"]}
            rows={matchExport}
          />
        ) : (
          <InsightsExport
            filename="champion-predictions.csv"
            headers={["User", "Email", "Selected Team", "Prediction Time"]}
            rows={champExport}
          />
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-border/60 bg-card/60 p-1.5">
        {[
          { key: "matches", label: "Match Predictions" },
          { key: "champion", label: "Tournament Winner" },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/admin/insights?tab=${t.key}`}
            className={cn(
              "rounded-xl px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              tab === t.key && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "matches" ? (
        <>
          <InsightsFilters
            sports={sports}
            categories={categories}
            teams={teams.map((t) => ({ id: t.id, name: t.name }))}
            users={users.map((u) => ({ id: u.id, name: u.name }))}
          />
          {matches.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                No fixtures match these filters. 🔍
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {matches.map((m) => (
                <PredictionInsightCard key={m.id} match={m} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <ChampionFilters
            teams={teams.map((t) => ({ id: t.id, name: t.name }))}
            users={users.map((u) => ({ id: u.id, name: u.name }))}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team Backing ({champTotal} picks)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {champByTeam.map(({ team, count }) => {
                const pct = champTotal ? Math.round((count / champTotal) * 100) : 0;
                return (
                  <div key={team.id} className="flex items-center gap-3">
                    <Avatar name={team.shortName} src={team.logoUrl} color={team.color} className="h-7 w-7 text-[10px]" />
                    <span className="w-32 truncate text-sm font-medium">{team.name}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: team.color }} />
                    </div>
                    <span className="w-16 text-right text-xs text-muted-foreground">{count} · {pct}%</span>
                  </div>
                );
              })}
              {champTotal === 0 && (
                <p className="py-3 text-center text-sm text-muted-foreground">No champion predictions yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="p-3 pl-5">User</th>
                      <th className="p-3">Selected Team</th>
                      <th className="p-3 pr-5">Prediction Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {champRows.map((p) => (
                      <tr key={p.id} className="border-b border-border/30 last:border-0">
                        <td className="p-3 pl-5">
                          <p className="font-medium">{p.user.name}</p>
                          <p className="text-xs text-muted-foreground">{p.user.email}</p>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.team.color }} />
                            {p.team.name}
                          </span>
                        </td>
                        <td className="p-3 pr-5 text-muted-foreground">{formatDateTime(p.createdAt)}</td>
                      </tr>
                    ))}
                    {champRows.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-6 text-center text-sm text-muted-foreground">
                          No champion predictions match these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
