import { prisma } from "@/lib/prisma";
import { updatePlayer } from "@/app/admin/actions";
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Players ({players.length})</CardTitle>
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
