import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFixtures } from "@/lib/fixtures";
import { getSettings, rulesValuesFrom } from "@/lib/scoring";
import { istDayKey, formatDate } from "@/lib/utils";
import { MatchCard } from "@/components/match-card";
import { FilterBar } from "@/components/filter-bar";
import { RulesButton } from "@/components/rules-button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Search = {
  sport?: string;
  status?: string;
  category?: string;
  team?: string;
  stage?: string;
  date?: string;
  q?: string;
};

export default async function FixturesPage(props: {
  searchParams: Promise<Search>;
}) {
  const sp = await props.searchParams;
  const session = await auth();
  const [fixtures, sports, settings] = await Promise.all([
    getFixtures(session?.user?.id),
    prisma.sport.findMany({ orderBy: { name: "asc" } }),
    getSettings(),
  ]);
  const rulesValues = rulesValuesFrom(settings);

  const categories = [...new Set(fixtures.map((f) => f.matchCategory))].sort();
  const stages = [...new Set(fixtures.map((f) => f.stage).filter(Boolean))].sort() as string[];
  const teams = [
    ...new Set(
      fixtures.flatMap((f) => [f.side1.teamName, f.side2.teamName].filter(Boolean))
    ),
  ].sort() as string[];
  // Match days, in chronological order, labelled in IST.
  const dates = [
    ...new Map(
      [...fixtures]
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((f) => [istDayKey(f.startTime), formatDate(f.startTime)])
    ).entries(),
  ].map(([value, label]) => ({ value, label }));

  const q = (sp.q ?? "").toLowerCase().trim();

  const filtered = fixtures.filter((f) => {
    if (sp.sport && f.sportName !== sp.sport) return false;
    if (sp.category && f.matchCategory !== sp.category) return false;
    if (sp.stage && f.stage !== sp.stage) return false;
    if (sp.date && istDayKey(f.startTime) !== sp.date) return false;
    if (sp.team && f.side1.teamName !== sp.team && f.side2.teamName !== sp.team)
      return false;
    if (
      q &&
      ![
        f.side1.label,
        f.side2.label,
        f.sportName,
        f.matchCategory,
        f.side1.teamName ?? "",
        f.side2.teamName ?? "",
        ...f.side1.players,
        ...f.side2.players,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    )
      return false;
    if (sp.status === "open") return f.isOpen;
    if (sp.status === "completed") return f.status === "COMPLETED";
    if (sp.status === "live") return f.status === "LIVE";
    if (sp.status === "closed")
      return !f.isOpen && f.status !== "COMPLETED" && f.status !== "LIVE";
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

      <RulesButton values={rulesValues} variant="card" />

      <FilterBar
        search={{ key: "q", placeholder: "Search player, team, sport…" }}
        filters={[
          { key: "date", allLabel: "All dates", options: dates },
          {
            key: "sport",
            allLabel: "All sports",
            options: sports.map((s) => ({ value: s.name, label: s.name })),
            className: "w-full sm:w-36",
          },
          {
            key: "category",
            allLabel: "All categories",
            options: categories.map((c) => ({ value: c, label: c })),
          },
          {
            key: "stage",
            allLabel: "All stages",
            options: stages.map((s) => ({ value: s, label: s })),
          },
          {
            key: "team",
            allLabel: "All teams",
            options: teams.map((t) => ({ value: t, label: t })),
          },
          {
            key: "status",
            allLabel: "All statuses",
            options: [
              { value: "open", label: "🟢 Open to predict" },
              { value: "closed", label: "🔒 Predictions closed" },
              { value: "live", label: "🟡 Live" },
              { value: "completed", label: "✅ Completed" },
            ],
            className: "w-full sm:w-44",
          },
        ]}
      />

      <p className="text-xs text-muted-foreground">
        Showing <strong>{filtered.length}</strong> of {fixtures.length} matches
      </p>

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
