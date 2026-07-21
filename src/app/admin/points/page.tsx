import { prisma } from "@/lib/prisma";
import { getTeamPointStandings, seedRulesFromFixtures } from "@/lib/team-points";
import {
  updateTeamPointRule, adjustTeamPoints, deleteTeamPointsAward, recomputeTeamPoints,
} from "@/app/admin/actions";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminPointsPage() {
  // Pre-fill rules from the schedule's imported values on first visit.
  await seedRulesFromFixtures();

  const [rules, sports, teams, standings, awards, fixtures] = await Promise.all([
    prisma.teamPointRule.findMany({ include: { sport: true } }),
    prisma.sport.findMany({ orderBy: { name: "asc" } }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    getTeamPointStandings(),
    prisma.teamPointsAward.findMany({
      include: { team: true },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.fixture.findMany({ select: { sportId: true, matchCategory: true } }),
  ]);

  // Every sport+category in the tournament, so points can be set for any of them.
  const combos = [...new Map(
    fixtures.map((f) => [`${f.sportId}|${f.matchCategory}`, f])
  ).values()]
    .map((f) => {
      const sport = sports.find((s) => s.id === f.sportId)!;
      const rule = rules.find((r) => r.sportId === f.sportId && r.matchCategory === f.matchCategory);
      return { sport, matchCategory: f.matchCategory, rule };
    })
    .sort((a, b) => a.sport.name.localeCompare(b.sport.name) || a.matchCategory.localeCompare(b.matchCategory));

  const totalAwarded = standings.reduce((s, t) => s + t.points, 0);

  return (
    <div className="space-y-6">
      {/* Standings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3">
            🏅 Sports Day Team Standings
            <Badge variant="secondary">{totalAwarded} pts awarded</Badge>
            <form action={recomputeTeamPoints} className="ml-auto">
              <Button type="submit" size="sm" variant="outline">🔄 Recompute from results</Button>
            </form>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {standings.map((t, i) => (
            <div key={t.teamId} className="flex items-center gap-3 text-sm">
              <span className="w-6 font-bold text-muted-foreground">
                {i === 0 && t.points > 0 ? "🥇" : i === 1 && t.points > 0 ? "🥈" : i === 2 && t.points > 0 ? "🥉" : i + 1}
              </span>
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="flex-1 font-medium">{t.name}</span>
              <span className="text-xs text-muted-foreground">
                {t.championships} 🏆 · {t.runnerUps} 🥈
              </span>
              <span className="w-16 text-right font-mono font-bold">{t.points} pts</span>
            </div>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">
            Points are awarded automatically when you publish a final result.
            Editing a result re-awards them; nothing double-counts.
          </p>
        </CardContent>
      </Card>

      {/* Point rules */}
      <Card>
        <CardHeader>
          <CardTitle>⚙️ Points per Sport &amp; Category</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Set how many points a <strong>Champion</strong> and <strong>Runner-up</strong> earn
            for their office team. Saving also updates that category&apos;s finals and
            re-awards any results already published.
          </p>
          <div className="space-y-1.5">
            {combos.map(({ sport, matchCategory, rule }) => (
              <form
                key={`${sport.id}|${matchCategory}`}
                action={updateTeamPointRule}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 p-2.5 text-sm"
              >
                <input type="hidden" name="sportId" value={sport.id} />
                <input type="hidden" name="matchCategory" value={matchCategory} />
                <Badge variant="secondary">{sport.icon} {sport.name}</Badge>
                <span className="min-w-40 flex-1 text-xs text-muted-foreground">{matchCategory}</span>
                <label className="text-xs text-muted-foreground">🏆</label>
                <Input
                  name="winnerPoints" type="number" step="any" min="0"
                  defaultValue={rule?.winnerPoints ?? 0} className="h-8 w-20"
                />
                <label className="text-xs text-muted-foreground">🥈</label>
                <Input
                  name="runnerUpPoints" type="number" step="any" min="0"
                  defaultValue={rule?.runnerUpPoints ?? 0} className="h-8 w-20"
                />
                <Button type="submit" size="sm" variant="outline">Save</Button>
              </form>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Manual adjustment */}
      <Card>
        <CardHeader>
          <CardTitle>✏️ Manual Adjustment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            For walkovers, penalties or corrections. Use a negative value to deduct.
            Manual entries survive recomputation.
          </p>
          <form action={adjustTeamPoints} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Team</label>
              <Select name="teamId" required className="w-52">
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Points (± )</label>
              <Input name="points" type="number" step="any" required className="w-28" />
            </div>
            <div className="min-w-52 flex-1">
              <label className="text-xs text-muted-foreground">Reason</label>
              <Input name="reason" placeholder="e.g. Walkover — opponent withdrew" required />
            </div>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      {/* Ledger */}
      <Card>
        <CardHeader>
          <CardTitle>📒 Award Ledger ({awards.length} most recent)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 p-3 sm:p-5">
          {awards.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No points awarded yet — they appear as finals are completed.
            </p>
          )}
          {awards.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/40 p-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.team.color }} />
              <span className="font-medium">{a.team.shortName}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{a.reason}</span>
              <span className="text-[11px] text-muted-foreground">{formatDateTime(a.createdAt)}</span>
              <span className={`w-14 text-right font-mono font-bold ${a.points >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {a.points > 0 ? "+" : ""}{a.points}
              </span>
              {a.type === "MANUAL" && (
                <form action={deleteTeamPointsAward}>
                  <input type="hidden" name="awardId" value={a.id} />
                  <Button size="sm" variant="destructive" type="submit">Remove</Button>
                </form>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
