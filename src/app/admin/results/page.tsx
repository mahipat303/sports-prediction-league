import { prisma } from "@/lib/prisma";
import { enterResult } from "@/app/admin/actions";
import { formatDateTime, istDayKey, formatDate } from "@/lib/utils";
import { EditResultForm } from "@/components/edit-result-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FilterBar, type FilterDef } from "@/components/filter-bar";
import { Tabs } from "@/components/tabs";

export const dynamic = "force-dynamic";

type Search = {
  tab?: string;
  sport?: string;
  date?: string;
  stage?: string;
  team?: string;
  q?: string;
};

export default async function AdminResultsPage(props: {
  searchParams: Promise<Search>;
}) {
  const sp = await props.searchParams;

  const [pending, completed, sports, teams] = await Promise.all([
    prisma.fixture.findMany({
      where: { status: { in: ["SCHEDULED", "LOCKED", "LIVE"] }, isPlaceholder: false },
      include: { sport: true, _count: { select: { predictions: true } } },
      orderBy: { startTime: "asc" },
    }),
    // Previously capped at 15, which silently hid results once filters were
    // applied — you would be filtering within a window, not within all results.
    prisma.fixture.findMany({
      where: { status: "COMPLETED" },
      include: {
        sport: true,
        resultEdits: { orderBy: { createdAt: "desc" }, take: 3 },
      },
      orderBy: { startTime: "desc" },
    }),
    prisma.sport.findMany({ orderBy: { name: "asc" } }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
  ]);

  const q = (sp.q ?? "").toLowerCase().trim();

  type Row = { sport: { name: string }; matchCategory: string; stage: string | null;
    side1Label: string; side2Label: string; startTime: Date;
    side1TeamId?: string | null; side2TeamId?: string | null };

  const matches = (f: Row, opts: { team?: boolean; stage?: boolean } = {}) => {
    if (sp.sport && f.sport.name !== sp.sport) return false;
    if (sp.date && istDayKey(f.startTime) !== sp.date) return false;
    if (opts.stage && sp.stage && f.stage !== sp.stage) return false;
    if (opts.team && sp.team && f.side1TeamId !== sp.team && f.side2TeamId !== sp.team)
      return false;
    if (
      q &&
      ![f.side1Label, f.side2Label, f.sport.name, f.matchCategory, f.stage ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    )
      return false;
    return true;
  };

  const filteredPending = pending.filter((f) => matches(f));
  const filteredCompleted = completed.filter((f) => matches(f, { team: true, stage: true }));

  const sportFilter: FilterDef = {
    key: "sport",
    allLabel: "All sports",
    options: sports.map((s) => ({ value: s.name, label: s.name })),
    className: "w-full sm:w-36",
  };
  const dateFrom = (rows: { startTime: Date }[]): FilterDef => ({
    key: "date",
    allLabel: "All dates",
    options: [
      ...new Map(rows.map((f) => [istDayKey(f.startTime), formatDate(f.startTime)])).entries(),
    ].map(([value, label]) => ({ value, label })),
  });
  const stages = [...new Set(completed.map((f) => f.stage).filter(Boolean))].sort() as string[];

  const enterTab = (
    <Card>
      <CardHeader>
        <CardTitle>
          🏁 Enter Results ({filteredPending.length}
          {filteredPending.length !== pending.length && ` of ${pending.length}`})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <FilterBar
          keep={["tab"]}
          search={{ key: "q", placeholder: "Search match, sport…" }}
          filters={[sportFilter, dateFrom(pending)]}
        />
        {pending.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No fixtures awaiting a result. Placeholder matches appear here
            once you fill in their participants. 🎉
          </p>
        )}
        {pending.length > 0 && filteredPending.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No pending fixtures match these filters. 🔍
          </p>
        )}
        {filteredPending.map((fixture) => (
          <form
            key={fixture.id}
            action={enterResult}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 p-3 text-sm"
          >
            <input type="hidden" name="fixtureId" value={fixture.id} />
            <Badge variant="secondary">{fixture.sport.icon} {fixture.sport.name}</Badge>
            <span className="text-xs text-muted-foreground">{fixture.matchCategory}</span>
            <span className="font-medium">
              {fixture.side1Label} vs {fixture.side2Label}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(fixture.startTime)} · {fixture._count.predictions} predictions
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Select name="winnerSide" required className="w-48">
                <option value="">Select winner…</option>
                <option value="1">{fixture.side1Label}</option>
                <option value="2">{fixture.side2Label}</option>
              </Select>
              <Input name="scoreSummary" placeholder="Score (optional)" className="w-36" />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" name="isUpset" className="accent-indigo-500" />
                Upset win
              </label>
              <Button type="submit" size="sm">Save &amp; Score</Button>
            </div>
          </form>
        ))}
      </CardContent>
    </Card>
  );

  const recentTab = (
    <Card>
      <CardHeader>
        <CardTitle>
          Recent Results ({filteredCompleted.length}
          {filteredCompleted.length !== completed.length && ` of ${completed.length}`})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <FilterBar
          keep={["tab"]}
          search={{ key: "q", placeholder: "Search match, sport…" }}
          filters={[
            sportFilter,
            dateFrom(completed),
            { key: "stage", allLabel: "All stages", options: stages.map((s) => ({ value: s, label: s })) },
            { key: "team", allLabel: "All teams", options: teams.map((t) => ({ value: t.id, label: t.name })) },
          ]}
        />
        {completed.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">No results yet.</p>
        )}
        {completed.length > 0 && filteredCompleted.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No results match these filters. 🔍
          </p>
        )}
        {filteredCompleted.map((fixture) => (
          <div key={fixture.id} className="space-y-2 rounded-xl border border-border/50 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{fixture.sport.icon} {fixture.sport.name}</Badge>
              <span className="text-xs text-muted-foreground">{fixture.matchCategory}</span>
              <span>{fixture.side1Label} vs {fixture.side2Label}</span>
              {fixture.scoreSummary && (
                <span className="font-mono text-xs text-muted-foreground">{fixture.scoreSummary}</span>
              )}
              <Badge variant="success" className="ml-auto">
                🏆 {fixture.winnerSide === 1 ? fixture.side1Label : fixture.side2Label}
              </Badge>
              {fixture.isUpset && <Badge variant="warning">Upset</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <EditResultForm
                fixtureId={fixture.id}
                side1Label={fixture.side1Label}
                side2Label={fixture.side2Label}
                winnerSide={fixture.winnerSide ?? 1}
                scoreSummary={fixture.scoreSummary}
                isUpset={fixture.isUpset}
              />
              {fixture.resultEdits.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  ✏️ Last updated by {fixture.resultEdits[0].editedByName} ·{" "}
                  {formatDateTime(fixture.resultEdits[0].createdAt)}
                  {fixture.resultEdits.length > 1 &&
                    ` (${fixture.resultEdits.length} edits)`}
                </span>
              )}
            </div>
            {fixture.resultEdits.length > 0 && (
              <div className="space-y-0.5 text-[11px] text-muted-foreground">
                {fixture.resultEdits.map((edit) => (
                  <p key={edit.id}>
                    {formatDateTime(edit.createdAt)} — {edit.editedByName} changed winner{" "}
                    {edit.prevWinnerSide
                      ? (edit.prevWinnerSide === 1 ? fixture.side1Label : fixture.side2Label)
                      : "—"}{" "}
                    → {edit.newWinnerSide === 1 ? fixture.side1Label : fixture.side2Label}
                    {edit.prevScore !== edit.newScore &&
                      `, score ${edit.prevScore ?? "—"} → ${edit.newScore ?? "—"}`}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <Tabs
      param="tab"
      items={[
        { key: "enter", label: `Enter Results (${pending.length})`, content: enterTab },
        { key: "recent", label: `Recent Results (${completed.length})`, content: recentTab },
      ]}
    />
  );
}
