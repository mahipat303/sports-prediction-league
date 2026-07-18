import { prisma } from "@/lib/prisma";
import { enterResult } from "@/app/admin/actions";
import { formatDateTime } from "@/lib/utils";
import { EditResultForm } from "@/components/edit-result-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export const dynamic = "force-dynamic";

export default async function AdminResultsPage() {
  const pending = await prisma.fixture.findMany({
    where: { status: { in: ["SCHEDULED", "LOCKED", "LIVE"] }, isPlaceholder: false },
    include: { sport: true, _count: { select: { predictions: true } } },
    orderBy: { startTime: "asc" },
  });
  const completed = await prisma.fixture.findMany({
    where: { status: "COMPLETED" },
    include: {
      sport: true,
      resultEdits: { orderBy: { createdAt: "desc" }, take: 3 },
    },
    orderBy: { startTime: "desc" },
    take: 15,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🏁 Enter Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No fixtures awaiting a result. Placeholder matches appear here
              once you fill in their participants. 🎉
            </p>
          )}
          {pending.map((fixture) => (
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
                <Button type="submit" size="sm">Save & Score</Button>
              </div>
            </form>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {completed.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">No results yet.</p>
          )}
          {completed.map((fixture) => (
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
    </div>
  );
}
