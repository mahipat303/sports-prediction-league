import { GitBranch } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buildBrackets, type BracketInput } from "@/lib/bracket";
import { BracketView } from "@/components/bracket-view";
import { FilterBar } from "@/components/filter-bar";
import { Tabs } from "@/components/tabs";
import { Card, CardContent } from "@/components/ui/card";

// Rendered per request, so publishing or editing a result, resolving a
// placeholder, or rescheduling a fixture is reflected immediately — the page
// is always built from current data, with no cache to invalidate.
export const dynamic = "force-dynamic";

type Search = { sport?: string; stage?: string; status?: string; q?: string };

export default async function BracketPage(props: { searchParams: Promise<Search> }) {
  const sp = await props.searchParams;

  const fixtures = (await prisma.fixture.findMany({
    include: {
      sport: true,
      side1Team: true,
      side2Team: true,
      players: { include: { player: true } },
      _count: { select: { predictions: true } },
    },
    orderBy: { startTime: "asc" },
  })) as unknown as BracketInput[];

  const all = buildBrackets(fixtures);
  const sports = [...new Set(all.map((b) => b.sportName))].sort();
  const stages = [
    ...new Set(fixtures.map((f) => f.stage).filter(Boolean)),
  ].sort() as string[];

  const q = (sp.q ?? "").toLowerCase().trim();

  // Filters narrow which *matches* are shown; a bracket disappears only when
  // nothing in it matches, so the tournament shape stays readable.
  const matches = (n: (typeof all)[number]["rounds"][number][number]) => {
    if (sp.stage && n.stage !== sp.stage) return false;
    if (sp.status) {
      const state =
        n.status === "COMPLETED" ? "completed"
        : n.status === "LIVE" ? "live"
        : n.isPlaceholder ? "waiting"
        : "upcoming";
      if (state !== sp.status) return false;
    }
    if (
      q &&
      ![
        n.side1.label, n.side2.label,
        n.side1.teamName ?? "", n.side2.teamName ?? "",
        ...n.side1.players, ...n.side2.players,
        n.stage ?? "", n.matchCategory,
      ].join(" ").toLowerCase().includes(q)
    )
      return false;
    return true;
  };

  const filterBracket = (b: (typeof all)[number]) => {
    // Drop rounds the filter emptied, otherwise they render as a titled column
    // of blank space next to the matches that survived.
    const rounds = b.rounds
      .map((r) => r.filter(matches))
      .filter((r) => r.length > 0);
    return { ...b, rounds };
  };
  const hasAny = (b: (typeof all)[number]) => b.rounds.some((r) => r.length > 0);
  const filtersActive = Boolean(sp.stage || sp.status || q);

  const forSport = (sport: string) => {
    const list = all.filter((b) => b.sportName === sport);
    if (!filtersActive) return list;
    return list.map(filterBracket).filter(hasAny);
  };

  const totals = {
    matches: fixtures.length,
    played: fixtures.filter((f) => f.status === "COMPLETED").length,
    pending: fixtures.filter((f) => f.isPlaceholder).length,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <GitBranch className="h-6 w-6 text-primary" /> Tournament Flow
        </h1>
        <p className="text-sm text-muted-foreground">
          How every sport progresses from the group stage to the Grand Final —
          who has advanced, and which match decides each remaining slot.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {totals.played} of {totals.matches} matches played ·{" "}
          {totals.pending} still waiting on an earlier result
        </p>
      </div>

      <FilterBar
        keep={["sport"]}
        search={{ key: "q", placeholder: "Search player, team…" }}
        filters={[
          {
            key: "stage",
            allLabel: "All stages",
            options: stages.map((s) => ({ value: s, label: s })),
          },
          {
            key: "status",
            allLabel: "All statuses",
            options: [
              { value: "completed", label: "🟢 Completed" },
              { value: "live", label: "🟡 Live" },
              { value: "upcoming", label: "⚪ Upcoming" },
              { value: "waiting", label: "🔒 Waiting on earlier match" },
            ],
            className: "w-full sm:w-52",
          },
        ]}
      />

      {sports.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No fixtures yet — import the games schedule to see the tournament flow. 📅
          </CardContent>
        </Card>
      ) : (
        <Tabs
          param="sport"
          items={sports.map((sport) => {
            const icon = all.find((b) => b.sportName === sport)?.sportIcon ?? "";
            return {
              key: sport,
              label: `${icon} ${sport}`.trim(),
              content: <BracketView brackets={forSport(sport)} />,
            };
          })}
        />
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Tap any match for players, timing and result details. Updates
        automatically as results are published.
      </p>
    </div>
  );
}
