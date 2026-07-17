import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCurrency, CATEGORY_META } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export default async function TeamDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      players: {
        include: { assignments: { include: { sport: true } } },
        orderBy: [{ auctionPrice: "desc" }],
      },
    },
  });
  if (!team) notFound();

  const byCategory = ["PLATINUM", "GOLD", "SILVER", "BRONZE"].map((category) => ({
    category,
    players: team.players.filter((p) => p.category === category),
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/teams"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All teams
      </Link>

      <Card style={{ borderColor: `${team.color}55` }}>
        <CardContent className="p-6">
          <div
            className="mb-5 h-2 w-full rounded-full"
            style={{ backgroundColor: team.color }}
          />
          <div className="flex flex-wrap items-center gap-4">
            <Avatar
              name={team.shortName}
              src={team.logoUrl}
              color={team.color}
              className="h-16 w-16 text-xl"
            />
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{team.name}</h1>
              <p className="text-muted-foreground">Owned by {team.ownerName}</p>
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-2xl font-bold">{team.players.length}</p>
                <p className="text-xs text-muted-foreground">Players</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(team.remainingBudget)}</p>
                <p className="text-xs text-muted-foreground">Budget left</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatCurrency(team.totalBudget - team.remainingBudget)}
                </p>
                <p className="text-xs text-muted-foreground">Spent</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {byCategory.map(({ category, players }) => {
        if (players.length === 0) return null;
        const meta = CATEGORY_META[category];
        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle>
                {meta.emoji} {meta.label} Players ({players.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {players.map((player) => (
                  <Link key={player.id} href={`/players?q=${encodeURIComponent(player.name)}`}>
                    <div className="flex items-center gap-3 rounded-xl border border-border/50 p-3 transition-colors hover:bg-accent">
                      <Avatar name={player.name} src={player.avatarUrl} className="h-10 w-10 text-xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {player.name}
                          {player.specialBadge && (
                            <span className="ml-1.5 rounded-full bg-gradient-to-r from-amber-400/20 to-pink-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                              {player.specialBadge}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {player.assignments.map((a) => a.sport.name).join(", ") || "No sport assigned"}
                        </p>
                      </div>
                      <Badge variant="secondary" className="font-mono">
                        {formatCurrency(player.auctionPrice)}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
