import { prisma } from "@/lib/prisma";
import { matchPlayer, isPlaceholderLabel } from "@/lib/excel-import";

/**
 * Keeps fixture side→team snapshots (side1TeamId/side2TeamId) consistent with
 * the CURRENT player→team assignments. Sports Day has no mid-tournament
 * trades, so reassignment is always a data correction and historical fixtures
 * should reflect it.
 *
 * Display/stats metadata only — predictions, points, and results are never
 * touched by any of this.
 */

export interface ResolutionSummary {
  fixturesChecked: number;
  sidesUpdated: number;
  playersLinked: number;
}

/** Same rule as import: all matched players on a side share one team → that team. */
function resolveTeam(players: { teamId: string | null }[]): string | null {
  if (players.length === 0) return null;
  const teamIds = [...new Set(players.map((p) => p.teamId).filter(Boolean))];
  return teamIds.length === 1 ? (teamIds[0] as string) : null;
}

/** Re-derive both side-team snapshots for the given fixtures. */
export async function resolveFixtureSides(
  fixtureIds: string[]
): Promise<ResolutionSummary> {
  const summary: ResolutionSummary = {
    fixturesChecked: 0,
    sidesUpdated: 0,
    playersLinked: 0,
  };
  const fixtures = await prisma.fixture.findMany({
    where: { id: { in: fixtureIds } },
    include: { players: { include: { player: true } } },
  });

  for (const fixture of fixtures) {
    summary.fixturesChecked++;
    const side1 = resolveTeam(fixture.players.filter((p) => p.side === 1).map((p) => p.player));
    const side2 = resolveTeam(fixture.players.filter((p) => p.side === 2).map((p) => p.player));
    if (side1 !== fixture.side1TeamId || side2 !== fixture.side2TeamId) {
      await prisma.fixture.update({
        where: { id: fixture.id },
        data: { side1TeamId: side1, side2TeamId: side2 },
      });
      summary.sidesUpdated++;
    }
  }
  return summary;
}

/** Re-resolve the fixtures a single player appears in (after reassignment). */
export async function resolvePlayerFixtures(playerId: string) {
  const links = await prisma.fixturePlayer.findMany({
    where: { playerId },
    select: { fixtureId: true },
  });
  if (links.length === 0) return;
  await resolveFixtureSides([...new Set(links.map((l) => l.fixtureId))]);
}

/**
 * Full pass over every fixture: first retry name-matching for sides that
 * never linked any players (fixes cases like "Joy" once the right player
 * exists), then re-derive all side-team snapshots.
 */
export async function reresolveAllFixtures(): Promise<ResolutionSummary> {
  const [fixtures, allPlayers] = await Promise.all([
    prisma.fixture.findMany({ include: { players: true } }),
    prisma.player.findMany(),
  ]);

  let playersLinked = 0;
  for (const fixture of fixtures) {
    for (const side of [1, 2] as const) {
      const label = side === 1 ? fixture.side1Label : fixture.side2Label;
      const hasPlayers = fixture.players.some((p) => p.side === side);
      if (hasPlayers || isPlaceholderLabel(label)) continue;

      for (const part of label.split("/").map((p) => p.trim()).filter(Boolean)) {
        const player = matchPlayer(part, allPlayers);
        if (!player) continue;
        await prisma.fixturePlayer.upsert({
          where: { fixtureId_playerId: { fixtureId: fixture.id, playerId: player.id } },
          create: { fixtureId: fixture.id, playerId: player.id, side },
          update: { side },
        });
        await prisma.playerSportAssignment.upsert({
          where: { playerId_sportId: { playerId: player.id, sportId: fixture.sportId } },
          create: { playerId: player.id, sportId: fixture.sportId, category: player.category },
          update: {},
        });
        playersLinked++;
      }
    }
  }

  const summary = await resolveFixtureSides(fixtures.map((f) => f.id));
  summary.playersLinked = playersLinked;
  return summary;
}
