import { prisma } from "@/lib/prisma";
import { updateTeam } from "@/app/admin/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export default async function AdminTeamsPage() {
  const teams = await prisma.team.findMany({
    include: { _count: { select: { players: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Teams</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {teams.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No teams yet — import your Excel file first.
          </p>
        )}
        {teams.map((team) => (
          <form
            key={team.id}
            action={updateTeam}
            className="grid items-center gap-2 rounded-xl border border-border/50 p-3 sm:grid-cols-[auto_1fr_1fr_120px_120px_80px_auto]"
          >
            <input type="hidden" name="id" value={team.id} />
            <Avatar name={team.shortName} src={team.logoUrl} color={team.color} className="h-9 w-9 text-xs" />
            <Input name="name" defaultValue={team.name} aria-label="Team name" />
            <Input name="ownerName" defaultValue={team.ownerName} aria-label="Owner" />
            <Input name="totalBudget" type="number" step="any" defaultValue={team.totalBudget} aria-label="Total budget" />
            <Input name="remainingBudget" type="number" step="any" defaultValue={team.remainingBudget} aria-label="Remaining budget" />
            <Input name="color" type="color" defaultValue={team.color} aria-label="Team color" className="h-9 w-full p-1" />
            <Button type="submit" size="sm">Save</Button>
          </form>
        ))}
      </CardContent>
    </Card>
  );
}
