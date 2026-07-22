import { prisma } from "@/lib/prisma";
import {
  createFixture, setFixtureStatus, deleteFixture, updateFixtureSides, setFixtureLiveUrl,
  runBracketProgression, updateFixtureSchedule,
} from "@/app/admin/actions";
import { formatDateTime, istInputValue, istDayKey, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SelectOption } from "@/components/searchable-select";
import { BulkFixtureActions } from "@/components/bulk-fixture-actions";
import { FilterBar, type FilterDef } from "@/components/filter-bar";
import { Tabs } from "@/components/tabs";

export const dynamic = "force-dynamic";


const statusVariant: Record<string, "secondary" | "warning" | "live" | "success" | "destructive"> = {
  SCHEDULED: "secondary",
  LOCKED: "warning",
  LIVE: "live",
  COMPLETED: "success",
  CANCELLED: "destructive",
};

type Search = {
  tab?: string;
  sport?: string;
  status?: string;
  stage?: string;
  date?: string;
  team?: string;
  ph?: string;
  q?: string;
};

export default async function AdminFixturesPage(props: {
  searchParams: Promise<Search>;
}) {
  const sp = await props.searchParams;
  const [fixtures, sports, players, teams] = await Promise.all([
    prisma.fixture.findMany({
      include: {
        sport: true,
        side1Team: true,
        side2Team: true,
        _count: { select: { predictions: true } },
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.sport.findMany({ orderBy: { name: "asc" } }),
    prisma.player.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
  ]);

  const placeholders = fixtures.filter(
    (f) => f.isPlaceholder && f.status !== "COMPLETED"
  );

  // Build intelligent option lists for placeholder resolution, per sport +
  // category: winners of completed matches (most likely to advance) first,
  // then real participant labels from that bracket, then all player names.
  const playerNames = players.map((p) => p.name);
  const winnersByKey = new Map<string, Set<string>>();
  const participantsByKey = new Map<string, Set<string>>();
  for (const f of fixtures) {
    const key = `${f.sportId}|${f.matchCategory}`;
    if (f.status === "COMPLETED" && f.winnerSide) {
      const w = f.winnerSide === 1 ? f.side1Label : f.side2Label;
      (winnersByKey.get(key) ?? winnersByKey.set(key, new Set()).get(key)!).add(w);
    }
    if (!f.isPlaceholder) {
      const set = participantsByKey.get(key) ?? participantsByKey.set(key, new Set()).get(key)!;
      set.add(f.side1Label);
      set.add(f.side2Label);
    }
  }

  const optionsFor = (sportId: string, category: string): SelectOption[] => {
    const key = `${sportId}|${category}`;
    const winners = [...(winnersByKey.get(key) ?? [])];
    const participants = [...(participantsByKey.get(key) ?? [])];
    const seen = new Set<string>();
    const opts: SelectOption[] = [];
    for (const w of winners) {
      if (!seen.has(w)) { seen.add(w); opts.push({ value: w, label: `🏆 ${w}` }); }
    }
    for (const p of participants) {
      if (!seen.has(p)) { seen.add(p); opts.push({ value: p, label: p }); }
    }
    for (const n of playerNames) {
      if (!seen.has(n)) { seen.add(n); opts.push({ value: n, label: n }); }
    }
    return opts;
  };
  const hasWinners = (sportId: string, category: string) =>
    (winnersByKey.get(`${sportId}|${category}`)?.size ?? 0) > 0;

  // ---- filtering (display only; never changes what is stored) -------------
  type Row = (typeof fixtures)[number];
  const q = (sp.q ?? "").toLowerCase().trim();

  const matches = (f: Row) => {
    if (sp.sport && f.sport.name !== sp.sport) return false;
    if (sp.status && f.status !== sp.status) return false;
    if (sp.stage && f.stage !== sp.stage) return false;
    if (sp.date && istDayKey(f.startTime) !== sp.date) return false;
    if (sp.team && f.side1TeamId !== sp.team && f.side2TeamId !== sp.team) return false;
    if (sp.ph === "yes" && !f.isPlaceholder) return false;
    if (sp.ph === "no" && f.isPlaceholder) return false;
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

  const stages = [...new Set(fixtures.map((f) => f.stage).filter(Boolean))].sort() as string[];
  const dates = [
    ...new Map(fixtures.map((f) => [istDayKey(f.startTime), formatDate(f.startTime)])).entries(),
  ].map(([value, label]) => ({ value, label }));

  const sportFilter: FilterDef = {
    key: "sport",
    allLabel: "All sports",
    options: sports.map((s) => ({ value: s.name, label: s.name })),
    className: "w-full sm:w-36",
  };
  const stageFilter: FilterDef = {
    key: "stage",
    allLabel: "All stages",
    options: stages.map((s) => ({ value: s, label: s })),
  };
  const dateFilter: FilterDef = { key: "date", allLabel: "All dates", options: dates };
  const teamFilter: FilterDef = {
    key: "team",
    allLabel: "All teams",
    options: teams.map((t) => ({ value: t.id, label: t.name })),
  };
  const statusFilter: FilterDef = {
    key: "status",
    allLabel: "All statuses",
    options: ["SCHEDULED", "LOCKED", "LIVE", "COMPLETED", "CANCELLED"].map((s) => ({
      value: s,
      label: s,
    })),
    className: "w-full sm:w-36",
  };

  const filteredAll = fixtures.filter(matches);
  const filteredPlaceholders = placeholders.filter(matches);

  const allFixturesTab = (
    <Card>
      <CardHeader>
        <CardTitle>
          All Fixtures ({filteredAll.length}
          {filteredAll.length !== fixtures.length && ` of ${fixtures.length}`})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-3 sm:p-5">
        <FilterBar
          keep={["tab"]}
          search={{ key: "q", placeholder: "Search match, sport, stage…" }}
          filters={[sportFilter, statusFilter, stageFilter, dateFilter, teamFilter, {
            key: "ph",
            allLabel: "All matches",
            options: [
              { value: "yes", label: "🔁 Placeholders only" },
              { value: "no", label: "✅ Resolved only" },
            ],
            className: "w-full sm:w-44",
          }]}
        />
        {fixtures.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No fixtures yet — import the games schedule Excel or create one in the
            Create Fixture tab.
          </p>
        )}
        {fixtures.length > 0 && filteredAll.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No fixtures match these filters. 🔍
          </p>
        )}
        {filteredAll.map((fixture) => (
          <div
            key={fixture.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 p-3 text-sm"
          >
            <Badge variant="secondary">{fixture.sport.icon} {fixture.sport.name}</Badge>
            <span className="text-xs text-muted-foreground">{fixture.matchCategory}</span>
            <span className="font-medium">
              {fixture.side1Label} vs {fixture.side2Label}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(fixture.startTime)} · {fixture._count.predictions} predictions
            </span>
            <Badge variant={statusVariant[fixture.status]}>{fixture.status}</Badge>
            {fixture.isPlaceholder && <Badge variant="warning">Placeholder</Badge>}
            <div className="ml-auto flex gap-1">
              {fixture.status === "SCHEDULED" && (
                <form action={setFixtureStatus}>
                  <input type="hidden" name="fixtureId" value={fixture.id} />
                  <input type="hidden" name="status" value="LOCKED" />
                  <Button size="sm" variant="outline" type="submit">Lock</Button>
                </form>
              )}
              {(fixture.status === "SCHEDULED" || fixture.status === "LOCKED") && (
                <form action={setFixtureStatus}>
                  <input type="hidden" name="fixtureId" value={fixture.id} />
                  <input type="hidden" name="status" value="LIVE" />
                  <Button size="sm" variant="outline" type="submit">Start</Button>
                </form>
              )}
              {fixture.status !== "COMPLETED" && (
                <form action={deleteFixture}>
                  <input type="hidden" name="fixtureId" value={fixture.id} />
                  <Button size="sm" variant="destructive" type="submit">Delete</Button>
                </form>
              )}
            </div>
            <form action={updateFixtureSchedule} className="flex w-full items-center gap-2">
              <span className="text-xs text-muted-foreground">🗓️ Date &amp; time</span>
              <Input
                name="startTime"
                type="datetime-local"
                defaultValue={istInputValue(fixture.startTime)}
                className="h-8 w-56"
              />
              <input type="hidden" name="fixtureId" value={fixture.id} />
              <Button size="sm" variant="outline" type="submit">Save time</Button>
            </form>
            <form action={setFixtureLiveUrl} className="flex w-full items-center gap-2">
              <span className="text-xs text-muted-foreground">📺 Live link</span>
              <Input
                name="liveUrl"
                type="url"
                placeholder="https://… (YouTube, Meet, Zoom)"
                defaultValue={fixture.liveUrl ?? ""}
                className="h-8 flex-1"
              />
              <input type="hidden" name="fixtureId" value={fixture.id} />
              <Button size="sm" variant="outline" type="submit">Save link</Button>
            </form>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const resolveTab = (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3">
          🔁 Resolve Placeholder Matches ({filteredPlaceholders.length}
          {filteredPlaceholders.length !== placeholders.length && ` of ${placeholders.length}`})
          <form action={runBracketProgression} className="ml-auto">
            <Button type="submit" size="sm" variant="outline">
              ⚡ Run bracket progression
            </Button>
          </form>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          These resolve <strong>automatically</strong> when you publish a result —
          winners flow through Group → Group Final → Semi → Grand Final. Use the
          dropdowns below only as a manual override.
        </p>
        <FilterBar
          keep={["tab"]}
          search={{ key: "q", placeholder: "Search match, sport, stage…" }}
          filters={[sportFilter, stageFilter, dateFilter]}
        />
        {placeholders.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No unresolved placeholders. Everything has advanced. 🎉
          </p>
        )}
        {placeholders.length > 0 && filteredPlaceholders.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No placeholders match these filters. 🔍
          </p>
        )}
        {filteredPlaceholders.map((fixture) => {
          const options = optionsFor(fixture.sportId, fixture.matchCategory);
          return (
            <form
              key={fixture.id}
              action={updateFixtureSides}
              className="space-y-2 rounded-xl border border-border/50 p-3 text-sm"
            >
              <input type="hidden" name="fixtureId" value={fixture.id} />
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{fixture.sport.icon} {fixture.sport.name}</Badge>
                <span className="text-xs text-muted-foreground">
                  {fixture.matchCategory} · {fixture.stage}
                </span>
              </div>
              {!hasWinners(fixture.sportId, fixture.matchCategory) && (
                <p className="text-xs text-amber-500">
                  No eligible winners available yet — complete the earlier
                  matches first, or pick a participant below.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <SearchableSelect
                  name="side1Label"
                  options={options}
                  defaultValue={fixture.side1Label}
                  className="w-56"
                />
                <span className="text-xs font-bold">vs</span>
                <SearchableSelect
                  name="side2Label"
                  options={options}
                  defaultValue={fixture.side2Label}
                  className="w-56"
                />
                <Button type="submit" size="sm">Update</Button>
              </div>
            </form>
          );
        })}
      </CardContent>
    </Card>
  );

  const bulkTab = (
    <Card>
      <CardHeader>
        <CardTitle>⚡ Bulk Edit Fixtures</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters live inside the component: it holds the checkbox selection
            in client state, which a URL navigation would discard. */}
        <BulkFixtureActions
          sports={sports.map((s) => s.name)}
          stages={stages}
          fixtures={fixtures.map((f) => ({
            id: f.id,
            label: `${f.sport.icon ?? ""} ${f.sport.name} · ${f.matchCategory} · ${f.side1Label} vs ${f.side2Label}`,
            status: f.status,
            startTime: formatDateTime(f.startTime),
            sport: f.sport.name,
            stage: f.stage ?? "",
            category: f.matchCategory,
            day: istDayKey(f.startTime),
            dayLabel: formatDate(f.startTime),
          }))}
        />
      </CardContent>
    </Card>
  );

  const createTab = (
    <Card>
      <CardHeader>
        <CardTitle>➕ Create Fixture</CardTitle>
      </CardHeader>
      <CardContent>
        {sports.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Import the games schedule first (sports are created from it), or
            add fixtures after import.
          </p>
        ) : (
          <form action={createFixture} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Select name="sportId" required>
              {sports.map((sport) => (
                <option key={sport.id} value={sport.id}>{sport.icon} {sport.name}</option>
              ))}
            </Select>
            <Input name="matchCategory" placeholder="Category (e.g. Male Singles)" required />
            <Input name="stage" placeholder="Stage (e.g. Grand Final)" />
            <Input name="startTime" type="datetime-local" required />
            <Input name="side1Label" placeholder="Side 1 (e.g. Parth or A/B)" required />
            <Input name="side2Label" placeholder="Side 2" required />
            <Input name="winnerPoints" type="number" step="any" placeholder="Winner points (Sports Day)" />
            <Input name="liveUrl" type="url" placeholder="Live link (optional)" />
            <Button type="submit">Create</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Tabs
      param="tab"
      items={[
        { key: "all", label: `All Fixtures (${fixtures.length})`, content: allFixturesTab },
        { key: "resolve", label: `Resolve Placeholders (${placeholders.length})`, content: resolveTab },
        { key: "bulk", label: "Bulk Edit", content: bulkTab },
        { key: "create", label: "Create Fixture", content: createTab },
      ]}
    />
  );
}
