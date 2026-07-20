import { redirect } from "next/navigation";
import { CheckCircle2, XCircle, CircleDashed, Lock } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFixtures } from "@/lib/fixtures";
import { accuracy, cn, formatDateTime, CONFIDENCE_META } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MatchCard } from "@/components/match-card";
import { Tabs } from "@/components/tabs";
import { LockCountdown } from "@/components/lock-countdown";

export const dynamic = "force-dynamic";

export default async function PredictionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [predictions, entry, pointsLog, allFixtures] = await Promise.all([
    prisma.prediction.findMany({
      where: { userId: session.user.id },
      include: { fixture: { include: { sport: true } } },
      orderBy: { fixture: { startTime: "desc" } },
    }),
    prisma.leaderboardEntry.findUnique({ where: { userId: session.user.id } }),
    prisma.pointsHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    getFixtures(session.user.id),
  ]);

  // Predictions the user can still change (window open) — reuse the same
  // MatchCard + submitPrediction used on the Fixtures page (no new logic).
  const editable = allFixtures.filter((f) => f.myPrediction && f.isOpen);
  const editableIds = new Set(editable.map((f) => f.id));
  // History = everything that can no longer be changed.
  const past = predictions.filter((p) => !editableIds.has(p.fixtureId));

  const lockReason = (p: (typeof predictions)[number]) => {
    if (p.fixture.winnerSide) return "Result declared";
    if (p.fixture.status === "LIVE") return "Match started";
    return "Predictions closed";
  };

  const openPanel =
    editable.length === 0 ? (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          No open predictions right now. Head to{" "}
          <a href="/fixtures" className="text-primary hover:underline">Fixtures</a>{" "}
          to make some! 🎯
        </CardContent>
      </Card>
    ) : (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          These matches are still open — tap a side or change your confidence to
          update your pick. Changes save instantly.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {editable.map((fixture) => (
            <div key={fixture.id} className="space-y-1">
              <MatchCard fixture={fixture} />
              <p className="px-1 text-right text-[11px] text-muted-foreground">
                <LockCountdown lockTime={fixture.lockTime} />
              </p>
            </div>
          ))}
        </div>
      </div>
    );

  const historyPanel = (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="space-y-3 lg:col-span-2">
        {past.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nothing here yet — your locked and completed predictions will
              appear once matches start. 📜
            </CardContent>
          </Card>
        )}
        {past.map((p) => {
          const conf = CONFIDENCE_META[p.confidence];
          return (
            <Card key={p.id}>
              <CardContent className="flex items-center gap-3 p-4">
                {p.isCorrect === null ? (
                  <CircleDashed className="h-5 w-5 shrink-0 text-muted-foreground" />
                ) : p.isCorrect ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {p.fixture.side1Label} vs {p.fixture.side2Label}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {p.fixture.sport.icon} {p.fixture.sport.name} · {p.fixture.matchCategory}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You picked{" "}
                    <strong>
                      {p.predictedSide === 1 ? p.fixture.side1Label : p.fixture.side2Label}
                    </strong>
                    {p.fixture.winnerSide && (
                      <>
                        {" "}· Winner:{" "}
                        <strong>
                          {p.fixture.winnerSide === 1
                            ? p.fixture.side1Label
                            : p.fixture.side2Label}
                        </strong>
                      </>
                    )}{" "}
                    · {formatDateTime(p.fixture.startTime)}
                  </p>
                  {p.isCorrect === null && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-500">
                      <Lock className="h-3 w-3" /> {lockReason(p)}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <Badge variant="outline" className={cn("mb-1", conf.className)}>
                    {conf.label} {conf.multiplier}
                  </Badge>
                  <p
                    className={cn(
                      "font-mono text-sm font-bold",
                      p.pointsAwarded > 0
                        ? "text-emerald-500"
                        : p.pointsAwarded < 0
                          ? "text-red-500"
                          : "text-muted-foreground"
                    )}
                  >
                    {p.isCorrect === null
                      ? "pending"
                      : `${p.pointsAwarded > 0 ? "+" : ""}${p.pointsAwarded}`}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Points Log</h2>
        <Card>
          <CardContent className="divide-y divide-border/40 p-0">
            {pointsLog.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No points yet.
              </p>
            )}
            {pointsLog.map((h) => (
              <div key={h.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{h.reason}</span>
                <span
                  className={cn(
                    "font-mono font-bold",
                    h.points > 0 ? "text-emerald-500" : h.points < 0 ? "text-red-500" : "text-muted-foreground"
                  )}
                >
                  {h.points > 0 ? `+${h.points}` : h.points}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Predictions</h1>
        <p className="text-sm text-muted-foreground">
          Your calls, your points, your history.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total points", value: entry?.totalPoints ?? 0 },
          {
            label: "Accuracy",
            value: `${accuracy(entry?.correctPredictions ?? 0, entry?.wrongPredictions ?? 0)}%`,
          },
          { label: "Correct", value: entry?.correctPredictions ?? 0 },
          { label: "Best streak", value: entry?.bestStreak ?? 0 },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs
        items={[
          {
            key: "open",
            label: `✏️ Open Predictions${editable.length ? ` (${editable.length})` : ""}`,
            content: openPanel,
          },
          {
            key: "history",
            label: `📜 Prediction History${past.length ? ` (${past.length})` : ""}`,
            content: historyPanel,
          },
        ]}
      />
    </div>
  );
}
