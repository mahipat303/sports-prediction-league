import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import type { TeamStandingRow } from "@/lib/team-points";

const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`);

/**
 * The real Sports Day team score — points earned by each office team when its
 * players win or finish runner-up in a final. Independent of prediction points.
 */
export function SportsDayStandings({ rows }: { rows: TeamStandingRow[] }) {
  const total = rows.reduce((s, r) => s + r.points, 0);
  const max = Math.max(1, ...rows.map((r) => r.points));

  if (total === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          No Sports Day points awarded yet — they appear as soon as the first
          final is decided. 🏅
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 sm:p-5">
          <p className="mb-4 text-sm text-muted-foreground">
            Points your office team earns when its players win a final. Separate
            from prediction points.
          </p>
          <div className="space-y-4">
            {rows.map((t, i) => (
              <div key={t.teamId} className="flex items-center gap-3">
                <span className="w-7 text-center text-lg font-bold">{medal(i)}</span>
                <Avatar name={t.shortName} color={t.color} className="h-9 w-9 text-[10px]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{t.name}</span>
                    <span className="flex-shrink-0 font-mono text-lg font-bold">{t.points}</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(t.points / max) * 100}%`, backgroundColor: t.color }}
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t.championships} championship{t.championships === 1 ? "" : "s"} ·{" "}
                    {t.runnerUps} runner-up{t.runnerUps === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
