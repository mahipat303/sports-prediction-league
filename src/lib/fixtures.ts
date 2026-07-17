import { prisma } from "@/lib/prisma";
import { lockDueFixtures } from "@/lib/scoring";
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
  userId?: string
): MatchCardFixture {
  const mine = userId
    ? fixture.predictions.find((p) => p.userId === userId)
    : undefined;

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
    scoreSummary: fixture.scoreSummary,
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
  const fixtures = await prisma.fixture.findMany({
    include: fixtureInclude,
    orderBy: { startTime: "asc" },
  });
  return fixtures.map((f) => serializeFixture(f, userId));
}
