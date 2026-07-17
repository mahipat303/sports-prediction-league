import { prisma } from "@/lib/prisma";
import {
  createFixture, setFixtureStatus, deleteFixture, updateFixtureSides, setFixtureLiveUrl,
} from "@/app/admin/actions";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export const dynamic = "force-dynamic";

const statusVariant: Record<string, "secondary" | "warning" | "live" | "success" | "destructive"> = {
  SCHEDULED: "secondary",
  LOCKED: "warning",
  LIVE: "live",
  COMPLETED: "success",
  CANCELLED: "destructive",
};

export default async function AdminFixturesPage() {
  const [fixtures, sports] = await Promise.all([
    prisma.fixture.findMany({
      include: { sport: true, _count: { select: { predictions: true } } },
      orderBy: { startTime: "asc" },
    }),
    prisma.sport.findMany({ orderBy: { name: "asc" } }),
  ]);

  const placeholders = fixtures.filter(
    (f) => f.isPlaceholder && f.status !== "COMPLETED"
  );

  return (
    <div className="space-y-6">
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

      {placeholders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🔁 Resolve Placeholder Matches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Replace &quot;Winner Group A&quot; style labels with real names once earlier
              rounds finish. Predictions open automatically when both sides are real.
            </p>
            {placeholders.map((fixture) => (
              <form
                key={fixture.id}
                action={updateFixtureSides}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 p-3 text-sm"
              >
                <input type="hidden" name="fixtureId" value={fixture.id} />
                <Badge variant="secondary">{fixture.sport.icon} {fixture.sport.name}</Badge>
                <span className="text-xs text-muted-foreground">
                  {fixture.matchCategory} · {fixture.stage}
                </span>
                <Input name="side1Label" defaultValue={fixture.side1Label} className="w-52" />
                <span className="text-xs font-bold">vs</span>
                <Input name="side2Label" defaultValue={fixture.side2Label} className="w-52" />
                <Button type="submit" size="sm">Update</Button>
              </form>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Fixtures ({fixtures.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3 sm:p-5">
          {fixtures.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No fixtures yet — import the games schedule Excel or create one above.
            </p>
          )}
          {fixtures.map((fixture) => (
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
    </div>
  );
}
