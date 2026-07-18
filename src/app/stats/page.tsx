import { prisma } from "@/lib/prisma";
import { accuracy, formatCurrency } from "@/lib/utils";
import { computeTeamStandings } from "@/lib/standings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/tooltip";
import { StatsCharts } from "@/components/stats-charts";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const [fixtures, predictions, teams, allPlayers, entries] = await Promise.all([
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
      include: {
        team: true,
        fixturePlayers: {
          include: { fixture: { select: { status: true, winnerSide: true } } },
        },
      },
    }),
    prisma.leaderboardEntry.findMany({
      include: { user: true },
      orderBy: { totalPoints: "desc" },
    }),
  ]);

  const topBuys = [...allPlayers]
    .sort((a, b) => b.auctionPrice - a.auctionPrice)
    .slice(0, 5);

  // MVP: performance-first score. Win rate dominates; auction price is a
  // minor bonus so it separates near-equals but never outweighs performance.
  //   score = winRate×0.6 + wins×5 + played×2 + (price ÷ maxPrice)×10
  const maxPrice = Math.max(1, ...allPlayers.map((p) => p.auctionPrice));
  const mvpRanking = allPlayers
    .map((p) => {
      const done = p.fixturePlayers.filter((fp) => fp.fixture.status === "COMPLETED");
      const won = done.filter((fp) => fp.fixture.winnerSide === fp.side).length;
      const winRate = done.length ? (won / done.length) * 100 : 0;
      const score =
        winRate * 0.6 + won * 5 + done.length * 2 + (p.auctionPrice / maxPrice) * 10;
      return { player: p, played: done.length, won, winRate, score };
    })
    .filter((m) => m.played >= 1)
    .sort(
      (a, b) =>
        b.score - a.score || b.winRate - a.winRate || b.player.auctionPrice - a.player.auctionPrice
    );
  const mvp = mvpRanking[0];

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

  // Team win/played/won come from the shared standings helper (single source
  // of truth with the Leaderboard). Sports Day points stay here since they use
  // the schedule's winner/runner-up point values.
  const standings = computeTeamStandings(teams, fixtures);
  const teamStats = teams.map((team) => {
    const st = standings.find((s) => s.teamId === team.id)!;
    const played = fixtures.filter(
      (f) => f.side1TeamId === team.id || f.side2TeamId === team.id
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
      played: st.played,
      won: st.won,
      winPct: st.winPct,
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

  const highlights: { label: string; value: string; detail: string; tip?: string }[] = [
    {
      label: "Best predictor",
      value: best?.user.name ?? "—",
      detail: best ? `${accuracy(best.correctPredictions, best.wrongPredictions)}% accuracy` : "",
      tip: "The user with the highest total prediction points, among users with at least 3 scored predictions. Accuracy = (correct ÷ total scored predictions) × 100.",
    },
    {
      label: "Most predicted",
      value: mostPicked?.[0] ?? "—",
      detail: mostPicked ? `${mostPicked[1]} picks` : "",
      tip: "The player or pair chosen most often across all match predictions — the crowd favourite.",
    },
    {
      label: "Most successful team",
      value: bestTeam?.played ? bestTeam.fullName : "—",
      detail: bestTeam?.played ? `${bestTeam.winPct}% win rate` : "",
      tip: "Highest win rate = matches won ÷ matches played × 100. A team 'plays' a match when all the players on one side belong to it. Percentage-based, so 6/10 beats 8/15.",
    },
    {
      label: "Upset victories",
      value: String(upsets.length),
      detail: "underdog wins",
      tip: "Completed matches where the designated underdog won (marked as an upset by the admin). Correctly predicting these earns extra points.",
    },
    {
      label: "Most valuable player",
      value: mvp?.player.name ?? "—",
      detail: mvp
        ? `${Math.round(mvp.score)} pts · ${mvp.won}W/${mvp.played - mvp.won}L · ${Math.round(mvp.winRate)}% wins`
        : "Awarded after the first completed match",
      tip: "Performance-based score: Win Rate × 0.6 (dominant factor, up to 60) + Wins × 5 + Matches Played × 2 + a small auction bonus (price ÷ highest price × 10, max 10). Winning matches always outweighs a high auction price; price only separates players with similar performance. Requires at least 1 completed match.",
    },
    {
      label: "Toughest luck",
      value: worst && worst !== best ? worst.user.name : "—",
      detail: worst && worst !== best ? `${accuracy(worst.correctPredictions, worst.wrongPredictions)}% accuracy` : "",
      tip: "Lowest prediction accuracy among users with at least 3 scored predictions. All in good fun. 😅",
    },
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
        {highlights.map(({ label, value, detail, tip }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                {label}
                {tip && <InfoTip>{tip}</InfoTip>}
              </p>
              <p className="mt-1 truncate text-lg font-bold">{value}</p>
              {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {teamStats.some((t) => t.sportsDayPoints > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              🏆 Sports Day Team Standings
              <InfoTip>
                Real tournament points, not prediction points: for each completed
                match, the winning side&apos;s team earns that match&apos;s Winner
                Points and the other team gets Runner-up Points (values from the
                official schedule, e.g. finals are worth more).
              </InfoTip>
            </CardTitle>
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
            <CardTitle className="flex items-center gap-1.5">
              💰 Top Auction Buys
              <InfoTip>
                The five most expensive players from the auction. Purely about
                the price paid — see &quot;Most valuable player&quot; for
                performance-based value.
              </InfoTip>
            </CardTitle>
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
