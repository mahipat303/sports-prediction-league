import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFixtures } from "@/lib/fixtures";
import { MatchCard } from "@/components/match-card";
import { FixtureFilters } from "@/components/fixture-filters";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function FixturesPage(props: {
  searchParams: Promise<{ sport?: string; status?: string; category?: string }>;
}) {
  const searchParams = await props.searchParams;
  const session = await auth();
  const [fixtures, sports] = await Promise.all([
    getFixtures(session?.user?.id),
    prisma.sport.findMany({ orderBy: { name: "asc" } }),
  ]);

  const categories = [...new Set(fixtures.map((f) => f.matchCategory))].sort();

  const filtered = fixtures.filter((f) => {
    if (searchParams.sport && f.sportName !== searchParams.sport) return false;
    if (searchParams.category && f.matchCategory !== searchParams.category) return false;
    if (searchParams.status === "open") {
      return f.status === "SCHEDULED" && new Date(f.lockTime) > new Date();
    }
    if (searchParams.status === "completed") return f.status === "COMPLETED";
    if (searchParams.status === "live") return f.status === "LIVE";
    return true;
  });

  const upcoming = filtered.filter((f) => f.status !== "COMPLETED");
  const completed = filtered.filter((f) => f.status === "COMPLETED").reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fixtures</h1>
        <p className="text-sm text-muted-foreground">
          All Sports Day matches. Predictions lock automatically before each match.
        </p>
      </div>

      <FixtureFilters sports={sports.map((s) => s.name)} categories={categories} />

      {filtered.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No fixtures match your filters. 🔍
          </CardContent>
        </Card>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Upcoming & Live</h2>
          {upcoming.map((fixture) => (
            <MatchCard key={fixture.id} fixture={fixture} />
          ))}
        </section>
      )}

      {completed.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Completed</h2>
          {completed.map((fixture) => (
            <MatchCard key={fixture.id} fixture={fixture} />
          ))}
        </section>
      )}
    </div>
  );
}
