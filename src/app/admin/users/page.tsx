import { prisma } from "@/lib/prisma";
import { setUserRole, awardBonus } from "@/app/admin/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    include: { leaderboard: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users ({users.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 p-3 text-sm"
          >
            <Avatar name={user.name} src={user.image} className="h-9 w-9 text-xs" />
            <div className="min-w-0">
              <p className="font-medium">
                {user.name}{" "}
                {user.role === "ADMIN" && <Badge variant="warning">Admin</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {user.leaderboard?.totalPoints ?? 0} pts
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <form action={awardBonus} className="flex items-center gap-1.5">
                <input type="hidden" name="userId" value={user.id} />
                <Input name="points" type="number" placeholder="±pts" className="h-8 w-20 text-xs" required />
                <Input name="reason" placeholder="Reason" className="h-8 w-32 text-xs" />
                <Button type="submit" size="sm" variant="outline">Bonus</Button>
              </form>
              <form action={setUserRole}>
                <input type="hidden" name="userId" value={user.id} />
                <input
                  type="hidden"
                  name="role"
                  value={user.role === "ADMIN" ? "USER" : "ADMIN"}
                />
                <Button type="submit" size="sm" variant="ghost">
                  {user.role === "ADMIN" ? "Demote" : "Make admin"}
                </Button>
              </form>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
