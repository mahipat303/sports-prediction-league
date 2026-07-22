"use client";

import { useMemo } from "react";
import type { Bracket, BracketNode } from "@/lib/bracket";

/** Fixed geometry, so connector paths are exact maths rather than measurement. */
export const ROW_H = 78; // one first-round slot, including its gap
export const CARD_H = 66;
export const COL_W = 208;
export const COL_W_SM = 168;
export const GUTTER = 44;

export interface Placed {
  node: BracketNode;
  col: number;
  /** Half-open row range this node covers, in first-round slots. */
  start: number;
  end: number;
}

export interface BracketLayout {
  placed: Placed[];
  byId: Map<string, Placed>;
  rows: number;
  cols: number;
  /** parent id -> ids of the matches feeding it. */
  feeders: Map<string, string[]>;
  /** node id -> every match on its route, upstream and downstream. */
  lineage: Map<string, Set<string>>;
}

/**
 * Turn the dependency graph into a grid placement.
 *
 * Each first-round match takes one row; every later match spans exactly the
 * rows of the matches feeding it and sits centred within them, which puts it
 * on the true centroid of its feeders. That is what removes the dead space a
 * `justify-around` column left behind, and it holds for any depth or fan-in.
 *
 * Purely derived from the graph — no DOM measurement, so nothing can desync on
 * resize. Layout only; it never inspects or changes tournament logic.
 */
export function useBracketLayout(bracket: Bracket): BracketLayout {
  return useMemo(() => {
    const feeders = new Map<string, string[]>();
    for (const e of bracket.edges) {
      const list = feeders.get(e.to) ?? feeders.set(e.to, []).get(e.to)!;
      if (!list.includes(e.from)) list.push(e.from);
    }

    const byId = new Map<string, Placed>();
    const placed: Placed[] = [];
    let cursor = 0;

    bracket.rounds.forEach((round, col) => {
      const spans: Placed[] = round.map((node) => {
        const mine = (feeders.get(node.id) ?? [])
          .map((id) => byId.get(id))
          .filter((p): p is Placed => Boolean(p));

        if (mine.length === 0) {
          // A match nothing feeds — a genuine entry round. Takes one slot.
          return { node, col, start: cursor, end: cursor + 1 };
        }
        return {
          node,
          col,
          start: Math.min(...mine.map((p) => p.start)),
          end: Math.max(...mine.map((p) => p.end)),
        };
      });

      // Advance the first-round cursor only for the slots we just consumed.
      for (const s of spans) if ((feeders.get(s.node.id) ?? []).length === 0) cursor = s.end;

      // Safety net: malformed data could give two matches in the same column
      // overlapping rows, which would stack them on top of each other. Fall
      // back to an even split of the column rather than render them on top.
      const sorted = [...spans].sort((a, b) => a.start - b.start);
      const overlaps = sorted.some((s, i) => i > 0 && s.start < sorted[i - 1].end);
      const finalSpans = overlaps
        ? spans.map((s, i) => {
            const total = Math.max(cursor, spans.length);
            return {
              ...s,
              start: Math.floor((i * total) / spans.length),
              end: Math.floor(((i + 1) * total) / spans.length),
            };
          })
        : spans;

      for (const s of finalSpans) {
        placed.push(s);
        byId.set(s.node.id, s);
      }
    });

    const rows = Math.max(1, ...placed.map((p) => p.end));

    // The full route through a match — everything that leads into it and
    // everything it leads to. Hovering any match then shows the whole path
    // ("this player came from here, and goes on to there"), rather than only
    // the half behind it.
    const children = new Map<string, string[]>();
    for (const [to, froms] of feeders) {
      for (const f of froms) {
        const list = children.get(f) ?? children.set(f, []).get(f)!;
        list.push(to);
      }
    }

    const reach = (id: string, edges: Map<string, string[]>) => {
      const out = new Set<string>();
      const stack = [id];
      while (stack.length) {
        const cur = stack.pop()!;
        for (const nxt of edges.get(cur) ?? []) {
          if (out.has(nxt)) continue;
          out.add(nxt);
          stack.push(nxt);
        }
      }
      return out;
    };

    const lineage = new Map<string, Set<string>>();
    for (const p of placed) {
      const id = p.node.id;
      const set = new Set<string>([id]);
      for (const up of reach(id, feeders)) set.add(up);
      for (const down of reach(id, children)) set.add(down);
      lineage.set(id, set);
    }

    return { placed, byId, rows, cols: bracket.rounds.length, feeders, lineage };
  }, [bracket]);
}
