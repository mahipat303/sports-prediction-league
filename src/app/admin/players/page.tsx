import { prisma } from "@/lib/prisma";
import { updatePlayer, reresolveFixtures } from "@/app/admin/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export const dynamic = "force-dynamic";

export default async function AdminPlayersPage() {
  const [players, teams] = await Promise.all([
    prisma.player.findMany({
      include: { team: true },
      orderBy: [{ team: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
  ]);

  const unresolvedSides = await prisma.fixture.count({
    where: {
      isPlaceholder: false,
      OR: [{ side1TeamId: null }, { side2TeamId: null }],
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3">
          Edit Players ({players.length})
          <form action={reresolveFixtures} className="ml-auto flex items-center gap-2">
            {unresolvedSides > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                {unresolvedSides} fixture{unresolvedSides === 1 ? "" : "s"} with an unresolved side
              </span>
            )}
            <Button type="submit" size="sm" variant="outline">
              🔄 Re-resolve all fixtures
            </Button>
          </form>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Team changes here update historical fixtures, schedule, and team
          stats automatically. &quot;Re-resolve&quot; retries matching schedule names
          (e.g. after renaming a player) — it never touches predictions or results.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {players.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No players yet — import your Excel file first.
          </p>
        )}
        {players.map((player) => (
          <form
            key={player.id}
            action={updatePlayer}
            className="grid items-center gap-2 rounded-xl border border-border/50 p-3 sm:grid-cols-[1fr_150px_130px_130px_auto]"
          >
            <input type="hidden" name="id" value={player.id} />
            <Input name="name" defaultValue={player.name} aria-label="Player name" />
            <Select name="teamId" defaultValue={player.teamId ?? ""} aria-label="Team">
              <option value="">Unassigned</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </Select>
            <Select name="category" defaultValue={player.category} aria-label="Category">
              <option value="PLATINUM">💎 Platinum</option>
              <option value="GOLD">🥇 Gold</option>
              <option value="SILVER">🥈 Silver</option>
              <option value="BRONZE">🥉 Bronze</option>
            </Select>
            <Input
              name="auctionPrice"
              type="number"
              step="any"
              defaultValue={player.auctionPrice}
              aria-label="Auction price"
            />
            <Button type="submit" size="sm">Save</Button>
          </form>
        ))}
      </CardContent>
    </Card>
  );
}
