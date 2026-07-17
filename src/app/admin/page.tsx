import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setTournament } from "@/app/admin/actions";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [teams, players, sports, fixtures, users, predictions, pending, tournament] =
    await Promise.all([
      prisma.team.count(),
      prisma.player.count(),
      prisma.sport.count(),
      prisma.fixture.count(),
      prisma.user.count(),
      prisma.prediction.count(),
      prisma.fixture.count({ where: { status: { in: ["LOCKED", "LIVE"] } } }),
      prisma.tournament.findFirst({ where: { isActive: true } }),
    ]);

  const stats = [
    { label: "Teams", value: teams, href: "/admin/teams" },
    { label: "Players", value: players, href: "/admin/players" },
    { label: "Sports", value: sports, href: "/admin/fixtures" },
    { label: "Fixtures", value: fixtures, href: "/admin/fixtures" },
    { label: "Users", value: users, href: "/admin/users" },
    { label: "Predictions", value: predictions, href: "/admin/results" },
    { label: "Awaiting result", value: pending, href: "/admin/results" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ label, value, href }) => (
          <Link key={label} href={href}>
            <Card className="transition-colors hover:bg-accent/50">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>🗓️ Sports Day Date</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            {tournament
              ? `Current: ${tournament.name} on ${tournament.eventDate.toLocaleString("en-IN")}`
              : "No event date set — the home page countdown needs this."}
          </p>
          <form action={setTournament} className="flex flex-wrap gap-2">
            <Input
              name="name"
              placeholder="Event name"
              defaultValue={tournament?.name ?? "Sports Day 2026"}
              className="w-48"
            />
            <Input name="eventDate" type="datetime-local" required className="w-56" />
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>🚀 Quick Start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Set the Sports Day date above.</p>
          <p>2. <Link href="/admin/import" className="text-primary hover:underline">Import your Excel file</Link> with teams, players, auction prices, and fixtures.</p>
          <p>3. Review <Link href="/admin/fixtures" className="text-primary hover:underline">fixtures</Link> — predictions lock automatically before each match.</p>
          <p>4. On match day, <Link href="/admin/results" className="text-primary hover:underline">enter results</Link>. Points and the leaderboard update instantly.</p>
          <p>5. Tune point values in <Link href="/admin/settings" className="text-primary hover:underline">settings</Link> any time.</p>
        </CardContent>
      </Card>
    </div>
  );
}
