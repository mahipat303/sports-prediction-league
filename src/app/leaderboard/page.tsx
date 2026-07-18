import { Trophy, Flame } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { accuracy, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LeaderboardTabs } from "@/components/leaderboard-tabs";
import { TournamentStandings } from "@/components/tournament-standings";
import { computeTeamStandings, computePlayerStandings } from "@/lib/standings";

export const dynamic = "force-dynamic";

const medals = ["🥇", "🥈", "🥉"];

export default async function LeaderboardPage() {
  const session = await auth();
  const [entries, teams, fixtures, players] = await Promise.all([
    prisma.leaderboardEntry.findMany({
      orderBy: [{ totalPoints: "desc" }, { correctPredictions: "desc" }],
      include: { user: true },
    }),
    prisma.team.findMany(),
    prisma.fixture.findMany({
      where: { status: "COMPLETED" },
      select: { side1TeamId: true, side2TeamId: true, winnerSide: true, status: true },
    }),
    prisma.player.findMany({
      include: {
        team: true,
        fixturePlayers: {
          include: { fixture: { select: { status: true, winnerSide: true } } },
        },
      },
    }),
  ]);

  const teamStandings = computeTeamStandings(teams, fixtures);
  const playerStandings = computePlayerStandings(players);

  const predictionPanel = (
    <div className="space-y-6">
      {/* Podium for top 3 */}
      {entries.length >= 3 && (
        <div className="grid grid-cols-3 gap-3">
          {[entries[1], entries[0], entries[2]].map((entry, idx) => {
            const rank = idx === 1 ? 0 : idx === 0 ? 1 : 2;
            return (
              <Card
                key={entry.id}
                style={{ animationDelay: `${idx * 80}ms` }}
                className={cn(
                  "animate-in-up text-center",
                  rank === 0 && "border-amber-500/50 bg-amber-500/5 sm:-translate-y-2"
                )}
              >
                <CardContent className="flex flex-col items-center gap-2 p-4">
                  <span className="text-3xl">{medals[rank]}</span>
                  <Avatar name={entry.user.name} src={entry.user.image} className="h-12 w-12" />
                  <p className="truncate text-sm font-semibold">{entry.user.name}</p>
                  <p className="font-mono text-xl font-bold text-primary">
                    {entry.totalPoints}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {accuracy(entry.correctPredictions, entry.wrongPredictions)}% accurate
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              No one has scored yet. Make some predictions! 🎯
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-3 pl-5">Rank</th>
                    <th className="p-3">Name</th>
                    <th className="p-3 text-right">Points</th>
                    <th className="p-3 text-right">Accuracy</th>
                    <th className="hidden p-3 text-right sm:table-cell">Correct</th>
                    <th className="hidden p-3 text-right sm:table-cell">Wrong</th>
                    <th className="p-3 pr-5 text-right">Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, i) => {
                    const isMe = entry.userId === session?.user?.id;
                    return (
                      <tr
                        key={entry.id}
                        style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                        className={cn(
                          "animate-in-up border-b border-border/30 transition-colors hover:bg-accent/50",
                          i < 3 && "bg-amber-500/5",
                          isMe && "bg-primary/10"
                        )}
                      >
                        <td className="p-3 pl-5 font-bold">
                          {i < 3 ? medals[i] : i + 1}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Avatar name={entry.user.name} src={entry.user.image} className="h-7 w-7 text-[10px]" />
                            <span className="font-medium">
                              {entry.user.name}
                              {isMe && <Badge variant="secondary" className="ml-2">You</Badge>}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold">{entry.totalPoints}</td>
                        <td className="p-3 text-right">
                          {accuracy(entry.correctPredictions, entry.wrongPredictions)}%
                        </td>
                        <td className="hidden p-3 text-right text-emerald-500 sm:table-cell">
                          {entry.correctPredictions}
                        </td>
                        <td className="hidden p-3 text-right text-red-500 sm:table-cell">
                          {entry.wrongPredictions}
                        </td>
                        <td className="p-3 pr-5 text-right">
                          {entry.currentStreak > 0 ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-orange-500">
                              <Flame className="h-3.5 w-3.5" /> {entry.currentStreak}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Trophy className="h-6 w-6 text-amber-500" /> Leaderboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Prediction points and the live tournament standings.
        </p>
      </div>

      <LeaderboardTabs
        prediction={predictionPanel}
        standings={<TournamentStandings teams={teamStandings} players={playerStandings} />}
      />
    </div>
  );
}
