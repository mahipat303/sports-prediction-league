import { prisma } from "@/lib/prisma";
import { accuracy, formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCharts } from "@/components/stats-charts";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const [fixtures, predictions, teams, topBuys, entries] = await Promise.all([
    prisma.fixture.findMany({
      where: { status: "COMPLETED" },
      include: { sport: true },
    }),
    prisma.prediction.findMany({
      where: { isCorrect: { not: null } },
      include: { fixture: { include: { sport: true } } },
    }),
    prisma.team.findMany(),
    prisma.player.findMany({
      include: { team: true },
      orderBy: { auctionPrice: "desc" },
      take: 5,
    }),
    prisma.leaderboardEntry.findMany({
      include: { user: true },
      orderBy: { totalPoints: "desc" },
    }),
  ]);

  // Accuracy by sport / match category; most predicted side labels
  const bySport = new Map<string, { correct: number; total: number }>();
  const byCategory = new Map<string, { correct: number; total: number }>();
  const pickCounts = new Map<string, number>();
  for (const p of predictions) {
    const sport = p.fixture.sport.name;
    const s = bySport.get(sport) ?? { correct: 0, total: 0 };
    s.total++;
    if (p.isCorrect) s.correct++;
    bySport.set(sport, s);

    const c = byCategory.get(p.fixture.matchCategory) ?? { correct: 0, total: 0 };
    c.total++;
    if (p.isCorrect) c.correct++;
    byCategory.set(p.fixture.matchCategory, c);

    const label =
      p.predictedSide === 1 ? p.fixture.side1Label : p.fixture.side2Label;
    pickCounts.set(label, (pickCounts.get(label) ?? 0) + 1);
  }

  // Team success: Sports Day points earned via winning sides + win rate
  const teamStats = teams.map((team) => {
    const played = fixtures.filter(
      (f) => f.side1TeamId === team.id || f.side2TeamId === team.id
    );
    const won = played.filter((f) =>
      f.winnerSide === 1 ? f.side1TeamId === team.id : f.side2TeamId === team.id
    );
    const sportsDayPoints = played.reduce((sum, f) => {
      const isWinner =
        f.winnerSide === 1 ? f.side1TeamId === team.id : f.side2TeamId === team.id;
      return sum + (isWinner ? f.winnerPoints : f.runnerUpPoints);
    }, 0);
    return {
      name: team.shortName,
      fullName: team.name,
      color: team.color,
      played: played.length,
      won: won.length,
      winPct: played.length ? Math.round((won.length / played.length) * 100) : 0,
      sportsDayPoints,
    };
  });

  const upsets = fixtures.filter(
    (f) => f.isUpset || (f.underdogSide != null && f.underdogSide === f.winnerSide)
  );
  const scoredEntries = entries.filter(
    (e) => e.correctPredictions + e.wrongPredictions >= 3
  );
  const best = scoredEntries[0];
  const worst = [...scoredEntries].sort(
    (a, b) =>
      accuracy(a.correctPredictions, a.wrongPredictions) -
      accuracy(b.correctPredictions, b.wrongPredictions)
  )[0];
  const mostPicked = [...pickCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const bestTeam = [...teamStats].sort((a, b) => b.winPct - a.winPct)[0];

  const highlights = [
    { label: "Best predictor", value: best?.user.name ?? "—", detail: best ? `${accuracy(best.correctPredictions, best.wrongPredictions)}% accuracy` : "" },
    { label: "Most predicted", value: mostPicked?.[0] ?? "—", detail: mostPicked ? `${mostPicked[1]} picks` : "" },
    { label: "Most successful team", value: bestTeam?.played ? bestTeam.fullName : "—", detail: bestTeam?.played ? `${bestTeam.winPct}% win rate` : "" },
    { label: "Upset victories", value: String(upsets.length), detail: "underdog wins" },
    { label: "Most valuable player", value: topBuys[0]?.name ?? "—", detail: topBuys[0] ? formatCurrency(topBuys[0].auctionPrice) : "" },
    { label: "Toughest luck", value: worst && worst !== best ? worst.user.name : "—", detail: worst && worst !== best ? `${accuracy(worst.correctPredictions, worst.wrongPredictions)}% accuracy` : "" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Statistics</h1>
        <p className="text-sm text-muted-foreground">
          League-wide insights, updated after every result.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {highlights.map(({ label, value, detail }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 truncate text-lg font-bold">{value}</p>
              {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {teamStats.some((t) => t.sportsDayPoints > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>🏆 Sports Day Team Standings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...teamStats]
              .sort((a, b) => b.sportsDayPoints - a.sportsDayPoints)
              .map((t, i) => (
                <div key={t.name} className="flex items-center gap-3 text-sm">
                  <span className="w-5 font-bold text-muted-foreground">{i + 1}</span>
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="flex-1 font-medium">{t.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.won}W / {t.played - t.won}L
                  </span>
                  <span className="font-mono font-bold">{t.sportsDayPoints} pts</span>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      <StatsCharts
        sportAccuracy={[...bySport.entries()].map(([name, s]) => ({
          name,
          accuracy: accuracy(s.correct, s.total - s.correct),
          predictions: s.total,
        }))}
        categoryAccuracy={[...byCategory.entries()].map(([name, s]) => ({
          name,
          accuracy: accuracy(s.correct, s.total - s.correct),
          predictions: s.total,
        }))}
        teamStats={teamStats}
      />

      {topBuys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>💰 Top Auction Buys</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/40 p-0 px-5 pb-2">
            {topBuys.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-5 font-bold text-muted-foreground">{i + 1}</span>
                <span className="flex-1 font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.team?.name}</span>
                <span className="font-mono font-bold text-primary">
                  {formatCurrency(p.auctionPrice)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
