import { prisma } from "@/lib/prisma";
import { accuracy } from "@/lib/utils";
import { LEADERBOARD_ORDER } from "@/lib/scoring";
import { getTeamPointStandings } from "@/lib/team-points";
import { getCeremonyConfig, type CustomAward, type SoundCue } from "@/lib/ceremony-config";

/**
 * Read-only aggregator for the Awards Ceremony.
 *
 * This module DERIVES everything from data the tournament already produced —
 * completed fixtures, predictions, the leaderboard and the team-points awards.
 * It defines no new business logic and writes nothing; the scoring, standings
 * and team-points helpers remain the single source of truth. Rebuilding for a
 * future Sports Day means new data, not new code.
 */

export interface CeremonyRecap {
  totalPlayers: number;
  totalTeams: number;
  totalMatches: number;
  totalPredictions: number;
  predictionAccuracy: number; // %
  mostPredicted: { label: string; count: number } | null;
  biggestUpset: { label: string; category: string; sport: string } | null;
  longestStreak: { name: string; streak: number } | null;
  mvp: { name: string; team: string | null; teamColor: string | null; won: number; played: number } | null;
  championPoints: { name: string; shortName: string; color: string; points: number } | null;
}

export interface AwardWinner {
  label: string;
  teamName: string | null;
  teamColor: string | null;
}

export interface CategoryAward {
  id: string;
  sport: string;
  sportIcon: string | null;
  category: string;
  stage: string | null;
  champion: AwardWinner;
  runnerUp: AwardWinner | null;
  score: string | null;
  isUpset: boolean;
  /** Admin-configured (Phase 2); null when unset. */
  presenter: string | null;
  description: string | null;
}

export interface TeamAward {
  teamId: string;
  name: string;
  shortName: string;
  color: string;
  points: number;
  championships: number;
  runnerUps: number;
  rank: number;
}

export interface PredictionAward {
  rank: number;
  name: string;
  totalPoints: number;
  accuracy: number;
  correct: number;
  wrong: number;
  bestStreak: number;
}

export interface CeremonySound {
  enabled: boolean;
  style: "classic" | "fun";
  urls: Partial<Record<SoundCue, string>>;
}

export interface CeremonyData {
  recap: CeremonyRecap;
  categoryAwards: CategoryAward[];
  teamAwards: TeamAward[];
  predictionAwards: PredictionAward[];
  customAwards: CustomAward[];
  teamPresenters: { champion: string | null; runnerUp: string | null; third: string | null };
  speeches: { opening: string | null; closing: string | null };
  sound: CeremonySound;
  tournamentName: string;
  year: number;
}

const sideWinner = (
  f: { winnerSide: number | null; side1Label: string; side2Label: string; side1Team: { name: string; color: string } | null; side2Team: { name: string; color: string } | null }
): AwardWinner | null => {
  if (!f.winnerSide) return null;
  const team = f.winnerSide === 1 ? f.side1Team : f.side2Team;
  return {
    label: f.winnerSide === 1 ? f.side1Label : f.side2Label,
    teamName: team?.name ?? null,
    teamColor: team?.color ?? null,
  };
};
const sideLoser = (
  f: { winnerSide: number | null; side1Label: string; side2Label: string; side1Team: { name: string; color: string } | null; side2Team: { name: string; color: string } | null }
): AwardWinner | null => {
  if (!f.winnerSide) return null;
  const n = f.winnerSide === 1 ? 2 : 1;
  const team = n === 1 ? f.side1Team : f.side2Team;
  return {
    label: n === 1 ? f.side1Label : f.side2Label,
    teamName: team?.name ?? null,
    teamColor: team?.color ?? null,
  };
};

export interface AdminAward {
  id: string;
  sport: string;
  sportIcon: string | null;
  category: string;
  /** Auto-calculated winner from the result. */
  autoChampion: string;
  autoRunnerUp: string | null;
  /** Current display value (override if set, else auto). */
  champion: string;
  runnerUp: string | null;
  /** True when an admin override is in effect. */
  championOverridden: boolean;
  runnerUpOverridden: boolean;
  /** Dropdown options: the two finalists first, then every player. */
  options: string[];
  hidden: boolean;
  presenter: string;
  description: string;
}

/**
 * Every category award for the admin config screen — unlike `getCeremonyData`,
 * this does NOT drop hidden awards; it marks them, and lists them in the
 * currently-configured order so the reorder controls act on what's shown.
 */
export async function getCeremonyAdminAwards(): Promise<AdminAward[]> {
  const [finals, players, config] = await Promise.all([
    prisma.fixture.findMany({
      where: { stage: "Grand Final", status: "COMPLETED" },
      include: { sport: true },
      orderBy: [{ sport: { name: "asc" } }, { matchCategory: "asc" }],
    }),
    prisma.player.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    getCeremonyConfig(),
  ]);
  const playerNames = players.map((p) => p.name);
  const hidden = new Set(config.hidden);
  const rank = new Map(config.order.map((id, i) => [id, i]));
  return finals
    .map((f) => {
      const autoChampion =
        f.winnerSide === 1 ? f.side1Label : f.winnerSide === 2 ? f.side2Label : "—";
      const autoRunnerUp =
        f.winnerSide === 1 ? f.side2Label : f.winnerSide === 2 ? f.side1Label : null;
      const ov = config.winners[f.id] ?? {};
      // Options: the two finalists first (dedup), then all players.
      const seen = new Set<string>();
      const options: string[] = [];
      for (const label of [autoChampion, autoRunnerUp].filter((x): x is string => Boolean(x) && x !== "—")) {
        if (!seen.has(label)) { seen.add(label); options.push(label); }
      }
      for (const n of playerNames) if (!seen.has(n)) { seen.add(n); options.push(n); }
      return {
        id: f.id,
        sport: f.sport.name,
        sportIcon: f.sport.icon,
        category: f.matchCategory,
        autoChampion,
        autoRunnerUp,
        champion: ov.champion || autoChampion,
        runnerUp: ov.runnerUp || autoRunnerUp,
        championOverridden: Boolean(ov.champion),
        runnerUpOverridden: Boolean(ov.runnerUp),
        options,
        hidden: hidden.has(f.id),
        presenter: config.presenters[f.id] ?? "",
        description: config.descriptions[f.id] ?? "",
      };
    })
    .sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
}

export async function getCeremonyData(): Promise<CeremonyData> {
  const [
    tournament,
    finals,
    playerCount,
    teamCount,
    matchCount,
    predictionCount,
    scoredPredictions,
    players,
    entries,
    teamStandings,
  ] = await Promise.all([
    prisma.tournament.findFirst({ where: { isActive: true } }),
    prisma.fixture.findMany({
      where: { stage: "Grand Final", status: "COMPLETED" },
      include: { sport: true, side1Team: true, side2Team: true },
      orderBy: [{ sport: { name: "asc" } }, { matchCategory: "asc" }],
    }),
    prisma.player.count(),
    prisma.team.count(),
    prisma.fixture.count({ where: { status: "COMPLETED" } }),
    prisma.prediction.count(),
    prisma.prediction.findMany({
      where: { isCorrect: { not: null } },
      include: { fixture: { include: { sport: true } } },
    }),
    prisma.player.findMany({
      include: {
        team: true,
        fixturePlayers: { include: { fixture: { select: { status: true, winnerSide: true } } } },
      },
    }),
    prisma.leaderboardEntry.findMany({ include: { user: true }, orderBy: LEADERBOARD_ORDER }),
    getTeamPointStandings(),
  ]);

  const config = await getCeremonyConfig();

  // ---- recap ------------------------------------------------------------
  let correct = 0;
  const pickCounts = new Map<string, number>();
  const upsets: { label: string; category: string; sport: string }[] = [];
  for (const p of scoredPredictions) {
    if (p.isCorrect) correct++;
    const label = p.predictedSide === 1 ? p.fixture.side1Label : p.fixture.side2Label;
    pickCounts.set(label, (pickCounts.get(label) ?? 0) + 1);
  }
  // Same definition the Stats page uses: an explicit upset flag, or the
  // designated underdog going on to win.
  const upsetFixtures = await prisma.fixture.findMany({
    where: { status: "COMPLETED" },
    include: { sport: true },
  });
  for (const f of upsetFixtures) {
    const isUpset = f.isUpset || (f.underdogSide != null && f.underdogSide === f.winnerSide);
    if (!isUpset) continue;
    upsets.push({
      label: f.winnerSide === 1 ? f.side1Label : f.side2Label,
      category: f.matchCategory,
      sport: f.sport.name,
    });
  }

  const mostPickedEntry = [...pickCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const streakLeader = [...entries].sort((a, b) => b.bestStreak - a.bestStreak)[0];

  // MVP — same formula as the Stats page (performance-first).
  const maxPrice = Math.max(1, ...players.map((p) => p.auctionPrice));
  const mvp = players
    .map((p) => {
      const done = p.fixturePlayers.filter((fp) => fp.fixture.status === "COMPLETED");
      const won = done.filter((fp) => fp.fixture.winnerSide === fp.side).length;
      const winRate = done.length ? (won / done.length) * 100 : 0;
      const score = winRate * 0.6 + won * 5 + done.length * 2 + (p.auctionPrice / maxPrice) * 10;
      return { player: p, played: done.length, won, score };
    })
    .filter((m) => m.played >= 1)
    .sort((a, b) => b.score - a.score)[0];

  const topTeam = teamStandings[0];

  const recap: CeremonyRecap = {
    totalPlayers: playerCount,
    totalTeams: teamCount,
    totalMatches: matchCount,
    totalPredictions: predictionCount,
    predictionAccuracy: accuracy(correct, scoredPredictions.length - correct),
    mostPredicted: mostPickedEntry ? { label: mostPickedEntry[0], count: mostPickedEntry[1] } : null,
    biggestUpset: upsets[0] ?? null,
    longestStreak: streakLeader?.bestStreak ? { name: streakLeader.user.name ?? "—", streak: streakLeader.bestStreak } : null,
    mvp: mvp ? { name: mvp.player.name, team: mvp.player.team?.name ?? null, teamColor: mvp.player.team?.color ?? null, won: mvp.won, played: mvp.played } : null,
    championPoints: topTeam ? { name: topTeam.name, shortName: topTeam.shortName, color: topTeam.color, points: topTeam.points } : null,
  };

  // ---- category awards (one per Grand Final) ----------------------------
  const hidden = new Set(config.hidden);

  // Name → team, so an overridden winner shows their own team colour. Doubles
  // labels ("A/B") won't match a single player and simply keep no team.
  const teamByName = new Map<string, { teamName: string | null; teamColor: string | null }>();
  for (const p of players) {
    teamByName.set(p.name, { teamName: p.team?.name ?? null, teamColor: p.team?.color ?? null });
  }
  /**
   * Presentation-only override. Replaces the displayed winner label (and
   * resolves the picked player's team) WITHOUT touching the fixture, result or
   * any derived stat. Falls back to the auto winner when unset.
   */
  const applyOverride = (name: string | undefined, auto: AwardWinner | null): AwardWinner | null => {
    if (!name) return auto;
    const team = teamByName.get(name);
    return { label: name, teamName: team?.teamName ?? null, teamColor: team?.teamColor ?? null };
  };

  const allCategoryAwards: CategoryAward[] = finals.map((f) => {
    const ov = config.winners[f.id] ?? {};
    return {
      id: f.id,
      sport: f.sport.name,
      sportIcon: f.sport.icon,
      category: f.matchCategory,
      stage: f.stage,
      champion: applyOverride(ov.champion, sideWinner(f)) ?? { label: "—", teamName: null, teamColor: null },
      runnerUp: applyOverride(ov.runnerUp, sideLoser(f)),
      score: f.scoreSummary,
      isUpset: f.isUpset,
      presenter: config.presenters[f.id] ?? null,
      description: config.descriptions[f.id] ?? null,
    };
  });

  // Apply the admin's hide + order choices: listed ids first in the given
  // order, everything else after in the default (sport/category) order.
  const rank = new Map(config.order.map((id, i) => [id, i]));
  const categoryAwards = allCategoryAwards
    .filter((a) => !hidden.has(a.id))
    .sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));

  // ---- team awards ------------------------------------------------------
  const teamAwards: TeamAward[] = teamStandings.map((t, i) => ({ ...t, rank: i + 1 }));

  // ---- prediction podium (already in LEADERBOARD_ORDER) -----------------
  const predictionAwards: PredictionAward[] = entries
    .filter((e) => e.correctPredictions + e.wrongPredictions >= 1)
    .slice(0, 3)
    .map((e, i) => ({
      rank: i + 1,
      name: e.user.name ?? "—",
      totalPoints: Math.round(e.totalPoints),
      accuracy: accuracy(e.correctPredictions, e.wrongPredictions),
      correct: e.correctPredictions,
      wrong: e.wrongPredictions,
      bestStreak: e.bestStreak,
    }));

  return {
    recap,
    categoryAwards,
    teamAwards,
    predictionAwards,
    customAwards: config.customAwards,
    teamPresenters: {
      champion: config.presenters["team:champion"] ?? null,
      runnerUp: config.presenters["team:runnerUp"] ?? null,
      third: config.presenters["team:third"] ?? null,
    },
    speeches: {
      opening: config.speeches.opening ?? null,
      closing: config.speeches.closing ?? null,
    },
    sound: {
      enabled: config.sound.enabled,
      style: config.sound.style,
      urls: config.sound.urls,
    },
    tournamentName: tournament?.name ?? "OpsHub Sports Day",
    year: tournament?.eventDate ? new Date(tournament.eventDate).getFullYear() : new Date().getFullYear(),
  };
}
