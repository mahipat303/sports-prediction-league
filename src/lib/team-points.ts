import { prisma } from "@/lib/prisma";

/**
 * Sports Day team points — the REAL tournament score, entirely separate from
 * user prediction points (PointsHistory / LeaderboardEntry).
 *
 * Flow: admin publishes a final result → the champion and runner-up sides are
 * resolved to office teams → points come from the admin-configured
 * TeamPointRule for that sport + category → TeamPointsAward rows are written.
 *
 * Idempotent: a fixture's awards are deleted and recreated on every run, so
 * editing a published result re-awards correctly with no double-counting.
 * Only fixtures that actually carry points (the finals) ever award.
 */

export interface TeamStandingRow {
  teamId: string;
  name: string;
  shortName: string;
  color: string;
  points: number;
  championships: number;
  runnerUps: number;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/**
 * Resolve a team-sport side label ("Team Aniket", "Team Akash") to an office
 * team by matching the owner name in the team's name ("Aniket & Jahnavi").
 * Tolerates small spelling differences (Akash / Aakash).
 */
export function matchTeamByLabel<T extends { id: string; name: string; shortName: string }>(
  label: string,
  teams: T[]
): T | null {
  const needle = label.trim().replace(/^team\s+/i, "").toLowerCase();
  if (!needle) return null;

  const owners = (t: T) => t.name.toLowerCase().split(/\s*&\s*/).map((o) => o.trim());

  const exact = teams.filter((t) => t.name.toLowerCase() === needle || t.shortName.toLowerCase() === needle);
  if (exact.length === 1) return exact[0];

  const byOwner = teams.filter((t) => owners(t).includes(needle));
  if (byOwner.length === 1) return byOwner[0];

  const byPrefix = teams.filter((t) => owners(t).some((o) => o.startsWith(needle) || needle.startsWith(o)));
  if (byPrefix.length === 1) return byPrefix[0];

  if (needle.length >= 4) {
    const fuzzy = teams.filter((t) => owners(t).some((o) => levenshtein(o, needle) <= 1));
    if (fuzzy.length === 1) return fuzzy[0];
  }
  return null;
}

/** Points for a fixture: the configured rule wins, else the fixture's own values. */
async function pointsFor(fixture: {
  sportId: string;
  matchCategory: string;
  winnerPoints: number;
  runnerUpPoints: number;
}) {
  const rule = await prisma.teamPointRule.findUnique({
    where: { sportId_matchCategory: { sportId: fixture.sportId, matchCategory: fixture.matchCategory } },
  });
  return {
    winnerPoints: rule ? rule.winnerPoints : fixture.winnerPoints,
    runnerUpPoints: rule ? rule.runnerUpPoints : fixture.runnerUpPoints,
  };
}

/** Resolve a fixture side to an office team: player links first, then label. */
async function teamForSide(
  fixture: { id: string; side1TeamId: string | null; side2TeamId: string | null; side1Label: string; side2Label: string },
  side: 1 | 2,
  teams: { id: string; name: string; shortName: string }[]
): Promise<string | null> {
  const snapshot = side === 1 ? fixture.side1TeamId : fixture.side2TeamId;
  if (snapshot) return snapshot;
  // Team sports ("Team Aniket") have no player links — fall back to the label.
  const label = side === 1 ? fixture.side1Label : fixture.side2Label;
  return matchTeamByLabel(label, teams)?.id ?? null;
}

export interface AwardResult {
  awarded: number;
  skipped: string[];
}

/**
 * (Re)award Sports Day points for one fixture. Safe to call on any fixture:
 * non-final / zero-point / unfinished fixtures simply clear and award nothing.
 */
export async function awardTeamPointsForFixture(fixtureId: string): Promise<AwardResult> {
  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    include: { sport: true },
  });
  if (!fixture) return { awarded: 0, skipped: ["fixture not found"] };

  // Always clear first — makes edits and downgrades idempotent.
  await prisma.teamPointsAward.deleteMany({ where: { fixtureId } });

  if (fixture.status !== "COMPLETED" || !fixture.winnerSide) return { awarded: 0, skipped: [] };

  // Only points-bearing matches (the finals) award. The rule is keyed by
  // sport + category, which a group match also matches — so the fixture's own
  // values decide WHETHER it awards; the rule decides HOW MUCH.
  if (fixture.winnerPoints <= 0 && fixture.runnerUpPoints <= 0) {
    return { awarded: 0, skipped: [] };
  }

  const { winnerPoints, runnerUpPoints } = await pointsFor(fixture);
  if (winnerPoints <= 0 && runnerUpPoints <= 0) return { awarded: 0, skipped: [] };

  const teams = await prisma.team.findMany({ select: { id: true, name: true, shortName: true } });
  const winnerSide = fixture.winnerSide as 1 | 2;
  const loserSide = (winnerSide === 1 ? 2 : 1) as 1 | 2;

  const label = (s: 1 | 2) => (s === 1 ? fixture.side1Label : fixture.side2Label);
  const context = `${fixture.sport.name} — ${fixture.matchCategory}`;
  const skipped: string[] = [];
  let awarded = 0;

  const rows: { teamId: string; points: number; type: "CHAMPION" | "RUNNER_UP"; reason: string }[] = [];

  if (winnerPoints > 0) {
    const teamId = await teamForSide(fixture, winnerSide, teams);
    if (teamId) rows.push({ teamId, points: winnerPoints, type: "CHAMPION", reason: `🏆 Champion — ${context} (${label(winnerSide)})` });
    else skipped.push(`Champion "${label(winnerSide)}" (${context}) — no office team resolved`);
  }
  if (runnerUpPoints > 0) {
    const teamId = await teamForSide(fixture, loserSide, teams);
    if (teamId) rows.push({ teamId, points: runnerUpPoints, type: "RUNNER_UP", reason: `🥈 Runner-up — ${context} (${label(loserSide)})` });
    else skipped.push(`Runner-up "${label(loserSide)}" (${context}) — no office team resolved`);
  }

  for (const r of rows) {
    await prisma.teamPointsAward.create({ data: { ...r, fixtureId } });
    awarded++;
  }
  return { awarded, skipped };
}

/** Rebuild every fixture's awards from scratch (manual adjustments preserved). */
export async function recomputeAllTeamPoints() {
  const fixtures = await prisma.fixture.findMany({
    where: { status: "COMPLETED" },
    select: { id: true },
  });
  let awarded = 0;
  const skipped: string[] = [];
  for (const f of fixtures) {
    const r = await awardTeamPointsForFixture(f.id);
    awarded += r.awarded;
    skipped.push(...r.skipped);
  }
  return { fixtures: fixtures.length, awarded, skipped };
}

/** Current Sports Day standings, highest points first. */
export async function getTeamPointStandings(): Promise<TeamStandingRow[]> {
  const [teams, awards] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.teamPointsAward.findMany(),
  ]);
  return teams
    .map((t) => {
      const mine = awards.filter((a) => a.teamId === t.id);
      return {
        teamId: t.id,
        name: t.name,
        shortName: t.shortName,
        color: t.color,
        points: Math.round(mine.reduce((s, a) => s + a.points, 0) * 100) / 100,
        championships: mine.filter((a) => a.type === "CHAMPION").length,
        runnerUps: mine.filter((a) => a.type === "RUNNER_UP").length,
      };
    })
    .sort((a, b) => b.points - a.points || b.championships - a.championships || a.name.localeCompare(b.name));
}

/**
 * Seed point rules from the values already imported onto fixtures, so the
 * admin screen starts pre-filled with the schedule's numbers.
 */
export async function seedRulesFromFixtures() {
  const fixtures = await prisma.fixture.findMany({
    where: { OR: [{ winnerPoints: { gt: 0 } }, { runnerUpPoints: { gt: 0 } }] },
    select: { sportId: true, matchCategory: true, winnerPoints: true, runnerUpPoints: true },
  });
  let created = 0;
  for (const f of fixtures) {
    const key = { sportId_matchCategory: { sportId: f.sportId, matchCategory: f.matchCategory } };
    const existing = await prisma.teamPointRule.findUnique({ where: key });
    if (existing) continue;
    await prisma.teamPointRule.create({
      data: {
        sportId: f.sportId,
        matchCategory: f.matchCategory,
        winnerPoints: f.winnerPoints,
        runnerUpPoints: f.runnerUpPoints,
      },
    });
    created++;
  }
  return created;
}
