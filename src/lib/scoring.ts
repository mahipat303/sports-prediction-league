import { prisma } from "@/lib/prisma";
import { Confidence, NotificationType } from "@prisma/client";

// Admin-configurable scoring values with sensible defaults.
export const DEFAULT_SETTINGS = {
  POINTS_CORRECT: 10,
  POINTS_UPSET: 15,
  // Penalties for a wrong prediction, by confidence. Stored as positive
  // numbers and subtracted. Higher confidence = higher risk.
  PENALTY_LOW: 0,
  PENALTY_MEDIUM: 5,
  PENALTY_HIGH: 10,
  STREAK_BONUS: 5, // awarded per day the user predicted at least one match correctly
  PERFECT_DAY_BONUS: 20,
  CONFIDENCE_MEDIUM_MULT: 1.5,
  CONFIDENCE_HIGH_MULT: 2,
  CHAMPION_BONUS: 50, // bonus for correctly predicting the tournament winner
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

/** Penalty applied for a wrong prediction at a given confidence (positive). */
function confidencePenalty(
  confidence: Confidence,
  settings: Record<SettingKey, number>
): number {
  switch (confidence) {
    case "HIGH":
      return settings.PENALTY_HIGH;
    case "MEDIUM":
      return settings.PENALTY_MEDIUM;
    default:
      return settings.PENALTY_LOW;
  }
}

/** Shape the live scoring settings into the values the Rules explainer needs. */
export function rulesValuesFrom(settings: Record<SettingKey, number>) {
  return {
    pointsCorrect: settings.POINTS_CORRECT,
    pointsUpset: settings.POINTS_UPSET,
    medMult: settings.CONFIDENCE_MEDIUM_MULT,
    highMult: settings.CONFIDENCE_HIGH_MULT,
    penMed: settings.PENALTY_MEDIUM,
    penHigh: settings.PENALTY_HIGH,
    streak: settings.STREAK_BONUS,
    perfectDay: settings.PERFECT_DAY_BONUS,
    championBonus: settings.CHAMPION_BONUS,
    lockMinutes: settings.LOCK_MINUTES_BEFORE_START,
  };
}

/** Preview the points a confidence level yields for a given base — used by the UI. */
export function scorePreview(base: number, settings: Record<SettingKey, number>) {
  return {
    LOW: { correct: Math.round(base), wrong: -settings.PENALTY_LOW },
    MEDIUM: {
      correct: Math.round(base * settings.CONFIDENCE_MEDIUM_MULT),
      wrong: -settings.PENALTY_MEDIUM,
    },
    HIGH: {
      correct: Math.round(base * settings.CONFIDENCE_HIGH_MULT),
      wrong: -settings.PENALTY_HIGH,
    },
  };
}

/**
 * Evaluate all predictions for a completed fixture, award points, update the
 * leaderboard, and notify users. Called when the admin enters a result.
 *
 * Idempotent: this fixture's PointsHistory rows are replaced, not appended,
 * so re-running (mode "reevaluate", used when an admin corrects a published
 * result) always converges to the correct final state with no double-counting.
 * In reevaluate mode the per-prediction result notifications are replaced by a
 * single "result updated" notification per predictor, and the day's
 * streak/perfect bonuses are recomputed from scratch.
 */
export async function evaluateFixture(
  fixtureId: string,
  mode: "initial" | "reevaluate" = "initial"
) {
  const fixture = await prisma.fixture.findUniqueOrThrow({
    where: { id: fixtureId },
    include: { predictions: true, sport: true },
  });
  if (!fixture.winnerSide) throw new Error("Fixture has no winner set");

  const settings = await getSettings();

  // Replace (don't append) this fixture's points rows. Match-prediction rows
  // are the only PointsHistory entries that carry a fixtureId, so this is
  // precise. On first evaluation there is nothing to delete.
  await prisma.pointsHistory.deleteMany({ where: { fixtureId: fixture.id } });
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
      : -confidencePenalty(prediction.confidence, settings);

    const notification =
      mode === "initial"
        ? prisma.notification.create({
            data: {
              userId: prediction.userId,
              type: NotificationType.RESULT_DECLARED,
              title: isCorrect ? "You got it right! 🎉" : "Result declared",
              message: `${fixture.side1Label} vs ${fixture.side2Label} (${fixture.sport.name} ${fixture.matchCategory}): ${winnerName} won. ${
                isCorrect
                  ? `+${points} points!`
                  : points < 0
                    ? `${points} points — high-confidence miss.`
                    : "Better luck next time."
              }`,
              link: `/fixtures`,
            },
          })
        : prisma.notification.create({
            data: {
              userId: prediction.userId,
              type: NotificationType.RESULT_DECLARED,
              title: "Result updated ✏️",
              message: `The result of ${fixture.side1Label} vs ${fixture.side2Label} (${fixture.sport.name} ${fixture.matchCategory}) was corrected: ${winnerName} won. Your points for this match are now ${points > 0 ? "+" : ""}${points}.`,
              link: `/fixtures`,
            },
          });

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
      notification,
    ]);

    await recomputeLeaderboardEntry(prediction.userId);
  }

  // Daily bonuses are evaluated once all of today's fixtures are complete.
  // A corrected result can change who earned them, so recompute on edits.
  await awardDailyBonuses(fixture.startTime, settings, {
    recompute: mode === "reevaluate",
  });
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
  settings: Record<SettingKey, number>,
  opts: { recompute?: boolean } = {}
) {
  const dayStart = new Date(dayOf);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const dayKey = dayStart.toISOString().slice(0, 10);

  // When a published result is corrected, wipe the day's bonuses and re-derive
  // them from the corrected predictions (no duplicate notifications).
  if (opts.recompute) {
    await prisma.pointsHistory.deleteMany({
      where: {
        reason: {
          in: [`Daily streak bonus (${dayKey})`, `Perfect day bonus (${dayKey})`],
        },
      },
    });
  }

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
    if (correct === 0) {
      // In recompute mode their previous bonus may have just been deleted, so
      // their total still needs a refresh.
      if (opts.recompute) await recomputeLeaderboardEntry(userId);
      continue;
    }

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
      // Skip re-notifying on recomputation — users already got the original
      // bonus notification; only the numbers are being corrected.
      if (!opts.recompute) {
        await prisma.notification.create({
          data: {
            userId,
            type: NotificationType.ACHIEVEMENT,
            title: "Bonus points! ✨",
            message: `${bonus.reason.replace(/ \(.*\)$/, "")}: +${bonus.points} points`,
          },
        });
      }
    }
    await recomputeLeaderboardEntry(userId);
  }
}

/**
 * Score every user's tournament-winner pick once the admin sets the champion
 * team. Correct picks earn CHAMPION_BONUS; wrong picks get nothing (no
 * penalty). Idempotent — re-running re-syncs to the current champion.
 */
export async function evaluateChampionPredictions(tournamentId: string) {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    include: { championTeam: true, championPredictions: true },
  });
  if (!tournament.championTeamId) throw new Error("No champion team set");

  const settings = await getSettings();
  const bonus = settings.CHAMPION_BONUS;
  const reason = `Tournament winner bonus (${tournament.name})`;

  for (const pick of tournament.championPredictions) {
    const isCorrect = pick.teamId === tournament.championTeamId;
    const points = isCorrect ? bonus : 0;

    // Reset any prior champion-bonus history for this user/tournament, then
    // re-add if correct — keeps re-reveals consistent.
    await prisma.pointsHistory.deleteMany({ where: { userId: pick.userId, reason } });
    await prisma.championPrediction.update({
      where: { id: pick.id },
      data: { isCorrect, pointsAwarded: points },
    });
    if (points !== 0) {
      await prisma.pointsHistory.create({
        data: { userId: pick.userId, points, reason },
      });
    }
    await prisma.notification.create({
      data: {
        userId: pick.userId,
        type: NotificationType.ACHIEVEMENT,
        title: isCorrect ? "Champion call nailed! 🏆" : "Tournament winner declared",
        message: isCorrect
          ? `${tournament.championTeam!.name} won the tournament — your pick was right! +${points} points.`
          : `${tournament.championTeam!.name} won the tournament. Your champion pick missed this time.`,
        link: "/",
      },
    });
    await recomputeLeaderboardEntry(pick.userId);
  }
}

/** Lock predictions for fixtures whose lock time has passed. */
export async function lockDueFixtures() {
  await prisma.fixture.updateMany({
    where: { status: "SCHEDULED", lockTime: { lte: new Date() } },
    data: { status: "LOCKED" },
  });
}
