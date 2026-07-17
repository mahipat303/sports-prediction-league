import { prisma } from "@/lib/prisma";
import { Confidence, NotificationType } from "@prisma/client";

// Admin-configurable scoring values with sensible defaults.
export const DEFAULT_SETTINGS = {
  POINTS_CORRECT: 10,
  POINTS_UPSET: 15,
  POINTS_WRONG: 0,
  STREAK_BONUS: 5, // awarded per day the user predicted at least one match correctly
  PERFECT_DAY_BONUS: 20,
  CONFIDENCE_MEDIUM_MULT: 1.5,
  CONFIDENCE_HIGH_MULT: 2,
  LOCK_MINUTES_BEFORE_START: 5,
} as const;

export type SettingKey = keyof typeof DEFAULT_SETTINGS;

export async function getSettings(): Promise<Record<SettingKey, number>> {
  const rows = await prisma.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]));
  const result = {} as Record<SettingKey, number>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
    result[key] = Number.isFinite(map[key]) ? map[key] : DEFAULT_SETTINGS[key];
  }
  return result;
}

function confidenceMultiplier(
  confidence: Confidence,
  settings: Record<SettingKey, number>
): number {
  switch (confidence) {
    case "HIGH":
      return settings.CONFIDENCE_HIGH_MULT;
    case "MEDIUM":
      return settings.CONFIDENCE_MEDIUM_MULT;
    default:
      return 1;
  }
}

/**
 * Evaluate all predictions for a completed fixture, award points, update the
 * leaderboard, and notify users. Called when the admin enters a result.
 */
export async function evaluateFixture(fixtureId: string) {
  const fixture = await prisma.fixture.findUniqueOrThrow({
    where: { id: fixtureId },
    include: { predictions: true, sport: true },
  });
  if (!fixture.winnerSide) throw new Error("Fixture has no winner set");

  const settings = await getSettings();
  const isUpset =
    fixture.isUpset ||
    (fixture.underdogSide !== null &&
      fixture.underdogSide === fixture.winnerSide);
  const basePoints = isUpset ? settings.POINTS_UPSET : settings.POINTS_CORRECT;
  const winnerName =
    fixture.winnerSide === 1 ? fixture.side1Label : fixture.side2Label;

  for (const prediction of fixture.predictions) {
    const isCorrect = prediction.predictedSide === fixture.winnerSide;
    const points = isCorrect
      ? Math.round(
          basePoints * confidenceMultiplier(prediction.confidence, settings)
        )
      : settings.POINTS_WRONG;

    await prisma.$transaction([
      prisma.prediction.update({
        where: { id: prediction.id },
        data: { isCorrect, pointsAwarded: points },
      }),
      prisma.pointsHistory.create({
        data: {
          userId: prediction.userId,
          fixtureId: fixture.id,
          points,
          reason: isCorrect
            ? `Correct prediction: ${fixture.sport.name} ${fixture.matchCategory} (${winnerName} won)${isUpset ? " — upset!" : ""}`
            : `Wrong prediction: ${fixture.sport.name} ${fixture.matchCategory}`,
        },
      }),
      prisma.notification.create({
        data: {
          userId: prediction.userId,
          type: NotificationType.RESULT_DECLARED,
          title: isCorrect ? "You got it right! 🎉" : "Result declared",
          message: `${fixture.side1Label} vs ${fixture.side2Label} (${fixture.sport.name} ${fixture.matchCategory}): ${winnerName} won. ${
            isCorrect ? `+${points} points!` : "Better luck next time."
          }`,
          link: `/fixtures`,
        },
      }),
    ]);

    await recomputeLeaderboardEntry(prediction.userId);
  }

  // Daily bonuses are evaluated once all of today's fixtures are complete.
  await awardDailyBonuses(fixture.startTime, settings);
}

/** Recompute a user's leaderboard entry from scratch (idempotent). */
export async function recomputeLeaderboardEntry(userId: string) {
  const [agg, predictions] = await Promise.all([
    prisma.pointsHistory.aggregate({
      where: { userId },
      _sum: { points: true },
    }),
    prisma.prediction.findMany({
      where: { userId, isCorrect: { not: null } },
      include: { fixture: { select: { startTime: true } } },
      orderBy: { fixture: { startTime: "asc" } },
    }),
  ]);

  const correct = predictions.filter((p) => p.isCorrect).length;
  const wrong = predictions.length - correct;

  // Streak = consecutive correct predictions counted from the most recent.
  let currentStreak = 0;
  for (let i = predictions.length - 1; i >= 0; i--) {
    if (predictions[i].isCorrect) currentStreak++;
    else break;
  }
  let bestStreak = 0;
  let run = 0;
  for (const p of predictions) {
    run = p.isCorrect ? run + 1 : 0;
    bestStreak = Math.max(bestStreak, run);
  }

  await prisma.leaderboardEntry.upsert({
    where: { userId },
    create: {
      userId,
      totalPoints: agg._sum.points ?? 0,
      correctPredictions: correct,
      wrongPredictions: wrong,
      currentStreak,
      bestStreak,
    },
    update: {
      totalPoints: agg._sum.points ?? 0,
      correctPredictions: correct,
      wrongPredictions: wrong,
      currentStreak,
      bestStreak,
    },
  });
}

/**
 * When every fixture on a given day is completed, award streak and
 * perfect-day bonuses. Safe to call repeatedly — bonuses are only granted
 * once per user per day (guarded by a reason string check).
 */
async function awardDailyBonuses(
  dayOf: Date,
  settings: Record<SettingKey, number>
) {
  const dayStart = new Date(dayOf);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const dayKey = dayStart.toISOString().slice(0, 10);

  const todaysFixtures = await prisma.fixture.findMany({
    where: {
      startTime: { gte: dayStart, lt: dayEnd },
      status: { not: "CANCELLED" },
    },
    include: { predictions: true },
  });
  if (todaysFixtures.length === 0) return;
  if (!todaysFixtures.every((f) => f.status === "COMPLETED")) return;

  // Group predictions by user for the day.
  const byUser = new Map<string, { correct: number; total: number }>();
  for (const fixture of todaysFixtures) {
    for (const p of fixture.predictions) {
      const entry = byUser.get(p.userId) ?? { correct: 0, total: 0 };
      entry.total++;
      if (p.isCorrect) entry.correct++;
      byUser.set(p.userId, entry);
    }
  }

  for (const [userId, { correct, total }] of byUser) {
    if (correct === 0) continue;

    const streakReason = `Daily streak bonus (${dayKey})`;
    const perfectReason = `Perfect day bonus (${dayKey})`;

    const existing = await prisma.pointsHistory.findFirst({
      where: { userId, reason: { in: [streakReason, perfectReason] } },
    });
    if (existing) continue;

    const bonuses: { reason: string; points: number }[] = [
      { reason: streakReason, points: settings.STREAK_BONUS },
    ];
    if (correct === total && total > 1) {
      bonuses.push({ reason: perfectReason, points: settings.PERFECT_DAY_BONUS });
    }

    for (const bonus of bonuses) {
      await prisma.pointsHistory.create({
        data: { userId, points: bonus.points, reason: bonus.reason },
      });
      await prisma.notification.create({
        data: {
          userId,
          type: NotificationType.ACHIEVEMENT,
          title: "Bonus points! ✨",
          message: `${bonus.reason.replace(/ \(.*\)$/, "")}: +${bonus.points} points`,
        },
      });
    }
    await recomputeLeaderboardEntry(userId);
  }
}

/** Lock predictions for fixtures whose lock time has passed. */
export async function lockDueFixtures() {
  await prisma.fixture.updateMany({
    where: { status: "SCHEDULED", lockTime: { lte: new Date() } },
    data: { status: "LOCKED" },
  });
}
