import { prisma } from "@/lib/prisma";
import { isPlaceholderLabel } from "@/lib/excel-import";
import { reresolveAllFixtures } from "@/lib/fixture-resolution";

/**
 * Automatic tournament bracket progression.
 *
 * Placeholder sides are plain labels ("Winner Group A Match 1"). This module
 * parses them into a structured reference, finds the fixture they point at
 * within the same sport + category, and substitutes the actual winner once
 * that match is decided — recursively, so a single result can cascade
 * Group → Group Final → Semi → Grand Final.
 *
 * Everything is DERIVED from current results, so re-running after an admin
 * edits a published result re-computes the bracket correctly (idempotent).
 *
 * Safety: only ever rewrites the labels of fixtures still flagged
 * `isPlaceholder`. Predictions, points, results, leaderboards and completed
 * fixtures are never touched.
 */

type FixtureLite = {
  id: string;
  sportId: string;
  matchCategory: string;
  stage: string | null;
  side1Label: string;
  side2Label: string;
  side1Source: string | null;
  side2Source: string | null;
  isPlaceholder: boolean;
  winnerSide: number | null;
  status: string;
  startTime: Date;
};

type Ref =
  | { kind: "groupMatch"; group: string; index: number } // Winner Group A Match 1
  | { kind: "group"; group: string } //                    Winner Group A
  | { kind: "stage"; stage: string; index: number } //     Winner Semi Final 2
  | { kind: "match"; index: number }; //                   Winner Match 1

/** Parse a placeholder label into a structured reference (null if unknown). */
export function parsePlaceholder(
  label: string
): { want: "winner" | "loser"; ref: Ref } | null {
  const raw = label.trim();
  const m = raw.match(/^(winner|runner-?up|loser)\s+(.*)$/i);
  if (!m) return null;
  const want: "winner" | "loser" = /^winner$/i.test(m[1]) ? "winner" : "loser";
  const rest = m[2].trim();

  // "Group A Match 1"
  let g = rest.match(/^group\s+([A-Z])\s+match\s+(\d+)$/i);
  if (g) return { want, ref: { kind: "groupMatch", group: g[1].toUpperCase(), index: Number(g[2]) } };

  // "Group A"
  g = rest.match(/^group\s+([A-Z])$/i);
  if (g) return { want, ref: { kind: "group", group: g[1].toUpperCase() } };

  // "Match 1"
  g = rest.match(/^match\s+(\d+)$/i);
  if (g) return { want, ref: { kind: "match", index: Number(g[1]) } };

  // "Semi Final 2", "Quarter Final 1", "Final" … (generic stage + optional index)
  g = rest.match(/^(.*?)\s*(\d+)?$/);
  if (g && g[1].trim()) {
    return { want, ref: { kind: "stage", stage: g[1].trim(), index: g[2] ? Number(g[2]) : 1 } };
  }
  return null;
}

const byTime = (a: FixtureLite, b: FixtureLite) =>
  a.startTime.getTime() - b.startTime.getTime() || a.id.localeCompare(b.id);

const stageIs = (f: FixtureLite, name: string) =>
  (f.stage ?? "").toLowerCase().replace(/\s+/g, " ").trim() ===
  name.toLowerCase().replace(/\s+/g, " ").trim();

/** The decided side label of a fixture, or null if not decided yet. */
function outcome(f: FixtureLite, want: "winner" | "loser"): string | null {
  if (f.status !== "COMPLETED" || !f.winnerSide) return null;
  const winner = f.winnerSide === 1 ? f.side1Label : f.side2Label;
  const loser = f.winnerSide === 1 ? f.side2Label : f.side1Label;
  const value = want === "winner" ? winner : loser;
  // Don't propagate an unresolved placeholder onward.
  return isPlaceholderLabel(value) ? null : value;
}

/** Locate the fixture a reference points at, within the same sport+category. */
function findTarget(ref: Ref, pool: FixtureLite[]): FixtureLite | null {
  switch (ref.kind) {
    case "groupMatch": {
      const inGroup = pool
        .filter((f) => stageIs(f, `Group ${ref.group} Initial`))
        .sort(byTime);
      return inGroup[ref.index - 1] ?? null;
    }
    case "match": {
      // "Winner Match 1" → the stage literally named "Initial Match 1", else
      // the Nth initial-round fixture in order.
      const exact = pool.filter((f) => stageIs(f, `Initial Match ${ref.index}`));
      if (exact.length === 1) return exact[0];
      const initials = pool.filter((f) => /initial/i.test(f.stage ?? "")).sort(byTime);
      return initials[ref.index - 1] ?? null;
    }
    case "stage": {
      const inStage = pool
        .filter((f) => stageIs(f, ref.stage))
        .sort(byTime);
      return inStage[ref.index - 1] ?? null;
    }
    case "group": {
      // The Group Final belonging to this group. While it is still a
      // placeholder we can read its own labels; once resolved we identify it
      // by its participants being winners of that group's initial matches.
      const finals = pool.filter((f) => stageIs(f, "Group Final"));
      const byLabel = finals.find((f) =>
        [f.side1Label, f.side2Label].some((l) =>
          new RegExp(`group\\s+${ref.group}\\b`, "i").test(l)
        )
      );
      if (byLabel) return byLabel;

      const groupWinners = new Set(
        pool
          .filter((f) => stageIs(f, `Group ${ref.group} Initial`))
          .map((f) => outcome(f, "winner"))
          .filter((v): v is string => Boolean(v))
          .map((v) => v.toLowerCase())
      );
      if (groupWinners.size === 0) return null;
      return (
        finals.find(
          (f) =>
            groupWinners.has(f.side1Label.toLowerCase()) ||
            groupWinners.has(f.side2Label.toLowerCase())
        ) ?? null
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Read-only bracket graph (Tournament Flow page)
// ---------------------------------------------------------------------------

export interface BracketSide {
  label: string;
  teamName: string | null;
  teamColor: string | null;
  players: string[];
  /** True when this side is still an unresolved reference to an earlier match. */
  pending: boolean;
}

export interface BracketNode {
  id: string;
  stage: string | null;
  matchCategory: string;
  status: string;
  startTime: string;
  venue: string | null;
  liveUrl: string | null;
  scoreSummary: string | null;
  isUpset: boolean;
  isPlaceholder: boolean;
  winnerSide: number | null;
  predictionCount: number;
  side1: BracketSide;
  side2: BracketSide;
  /** 0-based column: longest path from an entry-round match. */
  round: number;
}

export interface BracketEdge {
  from: string;
  to: string;
  toSide: 1 | 2;
  want: "winner" | "loser";
}

export interface Bracket {
  key: string;
  sportName: string;
  sportIcon: string | null;
  matchCategory: string;
  rounds: BracketNode[][];
  edges: BracketEdge[];
}

/** Shape `buildBrackets` needs — matches the include in the page's query. */
export type BracketInput = FixtureLite & {
  sport: { name: string; icon: string | null };
  matchCategory: string;
  venue: string | null;
  liveUrl: string | null;
  scoreSummary: string | null;
  isUpset: boolean;
  side1Team: { name: string; color: string } | null;
  side2Team: { name: string; color: string } | null;
  players: { side: number; player: { name: string } }[];
  _count: { predictions: number };
};

const MAX_DEPTH = 20; // guard against a malformed reference cycling forever

/**
 * Locate the upstream fixtures a reference points at, **for display only**.
 *
 * Starts from the same `findTarget` the progression engine uses. It adds one
 * fallback that progression does not have: `findTarget`'s "Winner Group X"
 * case looks exclusively for a fixture staged `Group Final`, but Badminton and
 * TT go straight from `Group X Initial` to the `Grand Final` with no group
 * final in between, so the reference resolves to nothing there.
 *
 * For the diagram we still know structurally that the final depends on that
 * group, so we link it to every initial match in the group (an N→1 fan-in).
 * This only affects what is drawn — it never resolves a participant and never
 * writes anything, so the bracket page can show the real shape of those 14
 * sport/category brackets while progression behaviour is left untouched.
 */
function findDisplayTargets(ref: Ref, pool: FixtureLite[]): FixtureLite[] {
  const direct = findTarget(ref, pool);
  if (direct) return [direct];
  if (ref.kind === "group") {
    return pool.filter((f) => stageIs(f, `Group ${ref.group} Initial`));
  }
  return [];
}

/**
 * Build a read-only dependency graph per sport + match category.
 *
 * Reuses the same `parsePlaceholder` + `findTarget` pair that drives
 * `propagateBracket`, so the diagram can never disagree with the progression
 * logic — it is the same traversal without the writes.
 *
 * A side's upstream reference is `side*Source` when it has already been
 * resolved (retained precisely so the link survives), otherwise the current
 * label while it is still a placeholder. Rounds are derived from the graph
 * (longest path from a root), never from hardcoded stage names, so a sport
 * with no group phase simply starts at its own entry round.
 */
export function buildBrackets(fixtures: BracketInput[]): Bracket[] {
  const groups = new Map<string, BracketInput[]>();
  for (const f of fixtures) {
    const key = `${f.sport.name}|${f.matchCategory}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(f);
  }

  const out: Bracket[] = [];
  for (const [key, pool] of groups) {
    const edges: BracketEdge[] = [];
    const incoming = new Map<string, BracketEdge[]>();

    for (const f of pool) {
      for (const side of [1, 2] as const) {
        const label = side === 1 ? f.side1Label : f.side2Label;
        const stored = side === 1 ? f.side1Source : f.side2Source;
        const source = stored ?? (isPlaceholderLabel(label) ? label : null);
        if (!source) continue;
        const parsed = parsePlaceholder(source);
        if (!parsed) continue;
        const targets = findDisplayTargets(
          parsed.ref,
          pool.filter((o) => o.id !== f.id)
        );
        for (const target of targets) {
          const edge: BracketEdge = {
            from: target.id,
            to: f.id,
            toSide: side,
            want: parsed.want,
          };
          edges.push(edge);
          (incoming.get(f.id) ?? incoming.set(f.id, []).get(f.id)!).push(edge);
        }
      }
    }

    // Longest path from a root. Memoised, with a visited set so a malformed
    // reference that forms a cycle cannot hang the page.
    const depthCache = new Map<string, number>();
    const depthOf = (id: string, seen: Set<string>): number => {
      const cached = depthCache.get(id);
      if (cached !== undefined) return cached;
      if (seen.has(id) || seen.size > MAX_DEPTH) return 0;
      seen.add(id);
      const parents = incoming.get(id) ?? [];
      const d = parents.length
        ? Math.min(
            MAX_DEPTH,
            Math.max(...parents.map((e) => depthOf(e.from, new Set(seen)) + 1))
          )
        : 0;
      depthCache.set(id, d);
      return d;
    };

    const sideOf = (f: BracketInput, n: 1 | 2): BracketSide => {
      const label = n === 1 ? f.side1Label : f.side2Label;
      const team = n === 1 ? f.side1Team : f.side2Team;
      return {
        label,
        teamName: team?.name ?? null,
        teamColor: team?.color ?? null,
        players: f.players.filter((p) => p.side === n).map((p) => p.player.name),
        pending: isPlaceholderLabel(label),
      };
    };

    const nodes: BracketNode[] = pool.map((f) => ({
      id: f.id,
      stage: f.stage,
      matchCategory: f.matchCategory,
      status: f.status,
      startTime: f.startTime.toISOString(),
      venue: f.venue,
      liveUrl: f.liveUrl,
      scoreSummary: f.scoreSummary,
      isUpset: f.isUpset,
      isPlaceholder: f.isPlaceholder,
      winnerSide: f.winnerSide,
      predictionCount: f._count.predictions,
      side1: sideOf(f, 1),
      side2: sideOf(f, 2),
      round: depthOf(f.id, new Set()),
    }));

    const maxRound = nodes.reduce((m, n) => Math.max(m, n.round), 0);
    const rounds: BracketNode[][] = Array.from({ length: maxRound + 1 }, () => []);
    for (const n of nodes) rounds[n.round].push(n);
    for (const r of rounds) {
      r.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime() ||
          a.id.localeCompare(b.id)
      );
    }

    const first = pool[0];
    out.push({
      key,
      sportName: first.sport.name,
      sportIcon: first.sport.icon,
      matchCategory: first.matchCategory,
      rounds,
      edges,
    });
  }

  return out.sort(
    (a, b) =>
      a.sportName.localeCompare(b.sportName) ||
      a.matchCategory.localeCompare(b.matchCategory)
  );
}

export interface PropagationChange {
  fixtureId: string;
  side: 1 | 2;
  from: string;
  to: string;
}

/**
 * Resolve every placeholder side that can be decided from current results,
 * repeating until nothing more changes (handles multi-level cascades).
 * Returns the list of substitutions made.
 */
export async function propagateBracket(): Promise<PropagationChange[]> {
  const changes: PropagationChange[] = [];

  // Bounded loop: each pass can unlock the next round.
  for (let pass = 0; pass < 10; pass++) {
    const fixtures = (await prisma.fixture.findMany({
      select: {
        id: true, sportId: true, matchCategory: true, stage: true,
        side1Label: true, side2Label: true, side1Source: true, side2Source: true,
        isPlaceholder: true, winnerSide: true, status: true, startTime: true,
      },
    })) as FixtureLite[];

    // A fixture is derivable if a side is still a placeholder, or was
    // previously resolved from one (so edits upstream can re-derive it).
    // Completed fixtures are historical and never rewritten.
    const pending = fixtures.filter(
      (f) =>
        f.status !== "COMPLETED" &&
        (f.isPlaceholder || f.side1Source || f.side2Source)
    );
    if (pending.length === 0) break;

    let changedThisPass = 0;
    for (const f of pending) {
      const pool = fixtures.filter(
        (o) => o.sportId === f.sportId && o.matchCategory === f.matchCategory && o.id !== f.id
      );
      const next: {
        side1Label?: string; side2Label?: string;
        side1Source?: string; side2Source?: string;
      } = {};

      for (const side of [1, 2] as const) {
        const label = side === 1 ? f.side1Label : f.side2Label;
        const stored = side === 1 ? f.side1Source : f.side2Source;
        // Use the remembered reference if we have one, else the current label.
        const source = stored ?? (isPlaceholderLabel(label) ? label : null);
        if (!source) continue;

        const parsed = parsePlaceholder(source);
        if (!parsed) continue;
        const target = findTarget(parsed.ref, pool);
        if (!target) continue;
        const resolved = outcome(target, parsed.want);
        if (!resolved) continue;

        // Remember where this side came from the first time we resolve it.
        if (!stored) {
          if (side === 1) next.side1Source = source;
          else next.side2Source = source;
        }
        if (resolved === label) continue;
        if (side === 1) next.side1Label = resolved;
        else next.side2Label = resolved;
        changes.push({ fixtureId: f.id, side, from: label, to: resolved });
      }

      if (Object.keys(next).length === 0) continue;

      const s1 = next.side1Label ?? f.side1Label;
      const s2 = next.side2Label ?? f.side2Label;
      await prisma.fixture.update({
        where: { id: f.id },
        data: {
          ...next,
          // Once both sides are real names the fixture opens for prediction.
          isPlaceholder: isPlaceholderLabel(s1) || isPlaceholderLabel(s2),
        },
      });
      changedThisPass++;
    }

    if (changedThisPass === 0) break;
  }

  // Newly resolved sides need their player links + team snapshots created;
  // this pass does both and is idempotent.
  if (changes.length > 0) await reresolveAllFixtures();
  return changes;
}
