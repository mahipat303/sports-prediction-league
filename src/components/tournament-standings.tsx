import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import type { TeamStanding, PlayerStanding } from "@/lib/standings";

const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`);

export function TournamentStandings({
  teams,
  players,
}: {
  teams: TeamStanding[];
  players: PlayerStanding[];
}) {
  const anyPlayed = teams.some((t) => t.played > 0) || players.length > 0;

  if (!anyPlayed) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Standings will appear here once matches are completed. 🎮
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team standings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🏅 Team Standings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="p-3 pl-5">Rank</th>
                  <th className="p-3">Team</th>
                  <th className="p-3 text-right">Played</th>
                  <th className="p-3 text-right text-emerald-500">Wins</th>
                  <th className="p-3 text-right text-red-500">Losses</th>
                  <th className="p-3 pr-5 text-right">Win %</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t, i) => (
                  <tr key={t.teamId} className="border-b border-border/30 last:border-0">
                    <td className="p-3 pl-5 font-bold">{t.played > 0 ? medal(i) : "—"}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                        <span className="font-medium">{t.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right tabular-nums">{t.played}</td>
                    <td className="p-3 text-right tabular-nums text-emerald-500">{t.won}</td>
                    <td className="p-3 text-right tabular-nums text-red-500">{t.lost}</td>
                    <td className="p-3 pr-5 text-right font-semibold tabular-nums">{t.winPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Player standings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🎯 Player Standings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {players.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No completed individual matches yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-3 pl-5">Rank</th>
                    <th className="p-3">Player</th>
                    <th className="hidden p-3 sm:table-cell">Team</th>
                    <th className="p-3 text-right">Played</th>
                    <th className="p-3 text-right text-emerald-500">Wins</th>
                    <th className="p-3 text-right text-red-500">Losses</th>
                    <th className="p-3 pr-5 text-right">Win %</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, i) => (
                    <tr key={p.playerId} className="border-b border-border/30 last:border-0">
                      <td className="p-3 pl-5 font-bold">{medal(i)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={p.name} color={p.teamColor ?? undefined} className="h-7 w-7 text-[10px]" />
                          <span className="font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="hidden p-3 text-xs text-muted-foreground sm:table-cell">
                        {p.teamName ?? "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">{p.played}</td>
                      <td className="p-3 text-right tabular-nums text-emerald-500">{p.won}</td>
                      <td className="p-3 text-right tabular-nums text-red-500">{p.lost}</td>
                      <td className="p-3 pr-5 text-right font-semibold tabular-nums">{p.winPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
