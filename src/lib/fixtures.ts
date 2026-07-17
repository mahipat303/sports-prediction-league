import { prisma } from "@/lib/prisma";
import { lockDueFixtures, getSettings, scorePreview, type SettingKey } from "@/lib/scoring";
import type { MatchCardFixture } from "@/components/match-card";
import type { Prisma } from "@prisma/client";

export type FixtureWithRelations = Prisma.FixtureGetPayload<{
  include: {
    sport: true;
    side1Team: true;
    side2Team: true;
    players: { include: { player: true } };
    predictions: true;
  };
}>;

export const fixtureInclude = {
  sport: true,
  side1Team: true,
  side2Team: true,
  players: { include: { player: true } },
  predictions: true,
} as const;

export function serializeFixture(
  fixture: FixtureWithRelations,
  userId?: string,
  settings?: Record<SettingKey, number>
): MatchCardFixture {
  const mine = userId
    ? fixture.predictions.find((p) => p.userId === userId)
    : undefined;

  const base = fixture.isUpset ? (settings?.POINTS_UPSET ?? 15) : (settings?.POINTS_CORRECT ?? 10);
  const preview = settings
    ? scorePreview(base, settings)
    : { LOW: { correct: 10, wrong: 0 }, MEDIUM: { correct: 15, wrong: -5 }, HIGH: { correct: 20, wrong: -10 } };

  const side = (n: 1 | 2) => {
    const team = n === 1 ? fixture.side1Team : fixture.side2Team;
    return {
      label: n === 1 ? fixture.side1Label : fixture.side2Label,
      teamName: team?.name ?? null,
      teamShortName: team?.shortName ?? null,
      color: team?.color ?? null,
      players: fixture.players
        .filter((p) => p.side === n)
        .map((p) => p.player.name),
      specialBadge:
        fixture.players.find((p) => p.side === n && p.player.specialBadge)?.player
          .specialBadge ?? null,
      pickCount: fixture.predictions.filter((p) => p.predictedSide === n).length,
    };
  };

  return {
    id: fixture.id,
    sportName: fixture.sport.name,
    sportIcon: fixture.sport.icon,
    matchCategory: fixture.matchCategory,
    stage: fixture.stage,
    status: fixture.status,
    isPlaceholder: fixture.isPlaceholder,
    isOpen:
      fixture.status === "SCHEDULED" &&
      !fixture.isPlaceholder &&
      fixture.lockTime.getTime() > Date.now(),
    startTime: fixture.startTime.toISOString(),
    lockTime: fixture.lockTime.toISOString(),
    venue: fixture.venue,
    liveUrl: fixture.liveUrl,
    scoreSummary: fixture.scoreSummary,
    confidencePreview: preview,
    winnerSide: fixture.winnerSide,
    winnerPoints: fixture.winnerPoints,
    side1: side(1),
    side2: side(2),
    myPrediction: mine
      ? {
          side: mine.predictedSide,
          confidence: mine.confidence,
          isCorrect: mine.isCorrect,
          points: mine.pointsAwarded,
        }
      : null,
    isLoggedIn: Boolean(userId),
  };
}

export async function getFixtures(userId?: string) {
  await lockDueFixtures();
  const [fixtures, settings] = await Promise.all([
    prisma.fixture.findMany({
      include: fixtureInclude,
      orderBy: { startTime: "asc" },
    }),
    getSettings(),
  ]);
  return fixtures.map((f) => serializeFixture(f, userId, settings));
}
