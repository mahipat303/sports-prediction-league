import Link from "next/link";
import { Trophy, TrendingUp, Target, ArrowRight, Sparkles, BookOpen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getFixtures } from "@/lib/fixtures";
import { getSettings, rulesValuesFrom } from "@/lib/scoring";
import { accuracy, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Countdown } from "@/components/countdown";
import { MatchCard } from "@/components/match-card";
import { ChampionPrediction } from "@/components/champion-prediction";
import { RulesContent } from "@/components/rules";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id;

  const [tournament, allFixtures, topEntries, teams, settings, myChampion] = await Promise.all([
    prisma.tournament.findFirst({ where: { isActive: true } }),
    getFixtures(userId),
    prisma.leaderboardEntry.findMany({
      orderBy: { totalPoints: "desc" },
      take: 5,
      include: { user: true },
    }),
    prisma.team.findMany({
      include: {
        _count: { select: { players: true, championPredictions: true } },
      },
    }),
    getSettings(),
    userId
      ? prisma.championPrediction.findFirst({
          where: { userId, tournament: { isActive: true } },
        })
      : null,
  ]);

  const totalChampionPicks = teams.reduce(
    (sum, t) => sum + t._count.championPredictions,
    0
  );
  const rulesValues = rulesValuesFrom(settings);

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);

  const todays = allFixtures.filter((f) => {
    const t = new Date(f.startTime);
    return t >= todayStart && t < todayEnd;
  });
  const upcoming = allFixtures
    .filter((f) => f.status === "SCHEDULED" && new Date(f.startTime) > now)
    .slice(0, 3);
  const results = allFixtures
    .filter((f) => f.status === "COMPLETED")
    .slice(-3)
    .reverse();
  const openForPrediction = allFixtures.filter(
    (f) => f.status === "SCHEDULED" && new Date(f.lockTime) > now
  );

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-indigo-600 via-violet-600 to-pink-600 p-6 text-white shadow-xl sm:p-10">
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge className="mb-3 bg-white/20 text-white backdrop-blur">
              <Sparkles className="h-3 w-3" /> Office Sports Day {tournament ? new Date(tournament.eventDate).getFullYear() : ""}
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
              Prediction League
            </h1>
            <p className="mt-2 max-w-md text-sm text-white/80 sm:text-base">
              Predict match winners, earn virtual points, compete with your
              colleagues, and win exciting prizes! 🏆
            </p>
            <p className="mt-1.5 max-w-md text-xs font-medium text-white/90 sm:text-sm">
              🥇 Top 3 predictors take home special prizes — on top of office
              bragging rights.
            </p>
            <div className="mt-4 flex gap-3">
              <Link href="/fixtures">
                <Button size="lg" className="bg-white text-indigo-700 hover:bg-white/90">
                  Predict Now <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10">
                  Leaderboard
                </Button>
              </Link>
            </div>
          </div>
          {tournament && (
            <Countdown
              target={tournament.eventDate.toISOString()}
              label="Countdown to Sports Day"
            />
          )}
        </div>
      </section>

      {/* Quick stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Teams", value: teams.length, icon: Trophy },
          { label: "Matches today", value: todays.length, icon: Target },
          { label: "Open for prediction", value: openForPrediction.length, icon: TrendingUp },
          { label: "Predictors on board", value: topEntries.length, icon: Sparkles },
        ].map(({ label, value, icon: Icon }) => (
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
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's / upcoming matches */}
        <section className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              {todays.length > 0 ? "Today's Matches" : "Upcoming Matches"}
            </h2>
            <Link href="/fixtures" className="text-sm text-primary hover:underline">
              View all →
            </Link>
          </div>
          {(todays.length > 0 ? todays : upcoming).length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No matches scheduled yet. The admin will import fixtures soon. 📅
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {(todays.length > 0 ? todays : upcoming).map((fixture) => (
                <MatchCard key={fixture.id} fixture={fixture} />
              ))}
            </div>
          )}

          {results.length > 0 && (
            <>
              <h2 className="pt-2 text-lg font-bold">Latest Results</h2>
              <div className="space-y-4">
                {results.map((fixture) => (
                  <MatchCard key={fixture.id} fixture={fixture} />
                ))}
              </div>
            </>
          )}
        </section>

        {/* Champion + leaderboard + teams preview */}
        <section className="space-y-4">
          {teams.length > 0 && (
            <ChampionPrediction
              teams={teams.map((t) => ({
                id: t.id,
                name: t.name,
                shortName: t.shortName,
                color: t.color,
                logoUrl: t.logoUrl,
                pickCount: t._count.championPredictions,
              }))}
              myTeamId={myChampion?.teamId ?? null}
              championTeamId={tournament?.championTeamId ?? null}
              lockTime={
                (tournament?.championLockTime ?? tournament?.eventDate)?.toISOString() ?? null
              }
              bonus={settings.CHAMPION_BONUS}
              isLoggedIn={Boolean(userId)}
              totalPicks={totalChampionPicks}
            />
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" /> Top Predictors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {topEntries.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No predictions scored yet. Be the first! 🎯
                </p>
              )}
              {topEntries.map((entry, i) => (
                <div
                  key={entry.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-2 py-2",
                    i === 0 && "bg-amber-500/10"
                  )}
                >
                  <span
                    className={cn(
                      "w-6 text-center font-bold",
                      i === 0 && "text-amber-500",
                      i === 1 && "text-slate-400",
                      i === 2 && "text-orange-600"
                    )}
                  >
                    {i + 1}
                  </span>
                  <Avatar name={entry.user.name} src={entry.user.image} className="h-8 w-8 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {accuracy(entry.correctPredictions, entry.wrongPredictions)}% accuracy
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold">{entry.totalPoints}</span>
                </div>
              ))}
              <Link href="/leaderboard" className="block pt-2">
                <Button variant="outline" className="w-full" size="sm">
                  Full leaderboard
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Teams</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {teams.map((team) => (
                <Link
                  key={team.id}
                  href={`/teams/${team.id}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-accent"
                >
                  <Avatar name={team.shortName} src={team.logoUrl} color={team.color} className="h-8 w-8 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{team.name}</p>
                    <p className="text-xs text-muted-foreground">{team.ownerName}</p>
                  </div>
                  <Badge variant="secondary">{team._count.players} players</Badge>
                </Link>
              ))}
              {teams.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Teams will appear after the admin imports data.
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Rules */}
      <section id="rules" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" /> How the Prediction League Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RulesContent v={rulesValues} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
