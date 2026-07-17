import Link from "next/link";
import { Users, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const teams = await prisma.team.findMany({
    include: { _count: { select: { players: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teams</h1>
        <p className="text-sm text-muted-foreground">
          The four squads battling it out on Sports Day.
        </p>
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No teams yet — the admin will import team data before the auction results are announced.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((team) => {
            const spent = team.totalBudget - team.remainingBudget;
            const spentPct = team.totalBudget
              ? (spent / team.totalBudget) * 100
              : 0;
            return (
              <Link key={team.id} href={`/teams/${team.id}`}>
                <Card
                  className="group h-full transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ borderColor: `${team.color}55` }}
                >
                  <CardContent className="p-5">
                    <div
                      className="mb-4 h-1.5 w-full rounded-full"
                      style={{ backgroundColor: team.color }}
                    />
                    <div className="flex items-center gap-4">
                      <Avatar
                        name={team.shortName}
                        src={team.logoUrl}
                        color={team.color}
                        className="h-14 w-14 text-lg"
                      />
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold group-hover:text-primary">
                          {team.name}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Owner: {team.ownerName}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>
                          <strong className="text-foreground">{team._count.players}</strong> players
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Wallet className="h-4 w-4" />
                        <span>
                          <strong className="text-foreground">
                            {formatCurrency(team.remainingBudget)}
                          </strong>{" "}
                          left
                        </span>
                      </div>
                    </div>
                    {team.totalBudget > 0 && (
                      <div className="mt-3">
                        <Progress value={spentPct} color={team.color} />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatCurrency(spent)} spent of {formatCurrency(team.totalBudget)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
