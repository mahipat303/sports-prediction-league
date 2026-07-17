import { redirect } from "next/navigation";
import { CheckCircle2, XCircle, CircleDashed } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accuracy, cn, formatDateTime, CONFIDENCE_META } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function PredictionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [predictions, entry, history] = await Promise.all([
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
  ]);

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

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          <h2 className="text-lg font-semibold">Prediction History</h2>
          {predictions.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                You haven&apos;t made any predictions yet. Head to Fixtures! 🎯
              </CardContent>
            </Card>
          )}
          {predictions.map((p) => {
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
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={cn("mb-1", conf.className)}>
                      {conf.label} {conf.multiplier}
                    </Badge>
                    <p className={cn(
                      "font-mono text-sm font-bold",
                      p.pointsAwarded > 0 ? "text-emerald-500" : "text-muted-foreground"
                    )}>
                      {p.isCorrect === null ? "pending" : `+${p.pointsAwarded}`}
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
              {history.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No points yet.
                </p>
              )}
              {history.map((h) => (
                <div key={h.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{h.reason}</span>
                  <span
                    className={cn(
                      "font-mono font-bold",
                      h.points > 0 ? "text-emerald-500" : "text-muted-foreground"
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
    </div>
  );
}
