import { prisma } from "@/lib/prisma";
import { formatCurrency, CATEGORY_META } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { PlayerFilters } from "@/components/player-filters";

export const dynamic = "force-dynamic";

export default async function PlayersPage(props: {
  searchParams: Promise<{ q?: string; team?: string; sport?: string; category?: string }>;
}) {
  const searchParams = await props.searchParams;
  const [players, teams, sports] = await Promise.all([
    prisma.player.findMany({
      include: {
        team: true,
        assignments: { include: { sport: true } },
        fixturePlayers: {
          include: { fixture: { select: { status: true, winnerSide: true } } },
        },
      },
      orderBy: { auctionPrice: "desc" },
    }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.sport.findMany({ orderBy: { name: "asc" } }),
  ]);

  const filtered = players.filter((player) => {
    if (
      searchParams.q &&
      !player.name.toLowerCase().includes(searchParams.q.toLowerCase())
    )
      return false;
    if (searchParams.team && player.team?.name !== searchParams.team) return false;
    if (searchParams.category && player.category !== searchParams.category) return false;
    if (
      searchParams.sport &&
      !player.assignments.some((a) => a.sport.name === searchParams.sport)
    )
      return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Players</h1>
        <p className="text-sm text-muted-foreground">
          Every employee sold at the auction, with prices and sport assignments.
        </p>
      </div>

      <PlayerFilters
        teams={teams.map((t) => t.name)}
        sports={sports.map((s) => s.name)}
      />

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No players found. Try different filters. 🔍
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((player, idx) => {
            const cat = CATEGORY_META[player.category];
            const played = player.fixturePlayers.filter(
              (fp) => fp.fixture.status === "COMPLETED"
            );
            const won = played.filter(
              (fp) => fp.fixture.winnerSide === fp.side
            ).length;
            return (
              <Card
                key={player.id}
                style={{ animationDelay: `${Math.min(idx, 12) * 35}ms` }}
                className="animate-in-up transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={player.name}
                      src={player.avatarUrl}
                      color={player.team?.color}
                      className="h-12 w-12"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{player.name}</p>
                      {player.specialBadge && (
                        <span className="mt-0.5 inline-block rounded-full bg-gradient-to-r from-amber-400/20 to-pink-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                          {player.specialBadge}
                        </span>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {player.team?.name ?? "Unassigned"}
                      </p>
                    </div>
                    <Badge variant="outline" className={cat.className}>
                      {cat.emoji} {cat.label}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {player.assignments.map((a) => (
                      <Badge key={a.id} variant="secondary" className="text-[11px]">
                        {a.sport.icon} {a.sport.name}
                      </Badge>
                    ))}
                    {player.assignments.length === 0 && (
                      <span className="text-xs text-muted-foreground">No sport assigned yet</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3 text-sm">
                    <span className="font-mono font-bold text-primary">
                      {formatCurrency(player.auctionPrice)}
                    </span>
                    {played.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {won}W / {played.length - won}L
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
