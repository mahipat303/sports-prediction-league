// Shared, read-only computation of real tournament standings from completed
// fixtures. Used by both the Stats page and the Leaderboard's Tournament
// Standings tab so there is a single source of truth (no duplicated logic).
// These are derived purely from existing data — no scoring/prediction impact.

export interface TeamStanding {
  teamId: string;
  name: string;
  shortName: string;
  color: string;
  played: number;
  won: number;
  lost: number;
  winPct: number;
}

export interface PlayerStanding {
  playerId: string;
  name: string;
  teamName: string | null;
  teamColor: string | null;
  played: number;
  won: number;
  lost: number;
  winPct: number;
}

type TeamLite = { id: string; name: string; shortName: string; color: string };
type FixtureLite = {
  side1TeamId: string | null;
  side2TeamId: string | null;
  winnerSide: number | null;
  status: string;
};

/** Team standings: a team "plays" a completed fixture when a side resolves to it. */
export function computeTeamStandings(
  teams: TeamLite[],
  fixtures: FixtureLite[]
): TeamStanding[] {
  const done = fixtures.filter((f) => f.status === "COMPLETED");
  return teams
    .map((team) => {
      const played = done.filter(
        (f) => f.side1TeamId === team.id || f.side2TeamId === team.id
      );
      const won = played.filter((f) =>
        f.winnerSide === 1 ? f.side1TeamId === team.id : f.side2TeamId === team.id
      ).length;
      const p = played.length;
      return {
        teamId: team.id,
        name: team.name,
        shortName: team.shortName,
        color: team.color,
        played: p,
        won,
        lost: p - won,
        winPct: p ? Math.round((won / p) * 100) : 0,
      };
    })
    .sort((a, b) => b.winPct - a.winPct || b.won - a.won || b.played - a.played);
}

type PlayerLite = {
  id: string;
  name: string;
  team: { name: string; color: string } | null;
  fixturePlayers: {
    side: number;
    fixture: { status: string; winnerSide: number | null };
  }[];
};

/** Player standings from FixturePlayer links vs the fixture's winning side. */
export function computePlayerStandings(players: PlayerLite[]): PlayerStanding[] {
  return players
    .map((pl) => {
      const done = pl.fixturePlayers.filter(
        (fp) => fp.fixture.status === "COMPLETED"
      );
      const won = done.filter((fp) => fp.fixture.winnerSide === fp.side).length;
      const p = done.length;
      return {
        playerId: pl.id,
        name: pl.name,
        teamName: pl.team?.name ?? null,
        teamColor: pl.team?.color ?? null,
        played: p,
        won,
        lost: p - won,
        winPct: p ? Math.round((won / p) * 100) : 0,
      };
    })
    .filter((s) => s.played > 0)
    .sort((a, b) => b.winPct - a.winPct || b.won - a.won || b.played - a.played);
}
