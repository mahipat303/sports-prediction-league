"use client";

import { GUTTER, ROW_H, type BracketLayout } from "./use-bracket-layout";

const RADIUS = 10;

/**
 * Elbow connectors drawn over the grid.
 *
 * Coordinates come from the placement maths, not from measuring the DOM, so
 * the lines cannot drift out of sync with the cards on resize or re-render.
 * Each path leaves a feeder's right edge, turns through a rounded corner onto
 * a shared vertical merge rail, and turns again into the left edge of the match
 * it feeds — so several matches converging on one (a group of four into a
 * single final) read as one join rather than four stray ticks.
 */
export function BracketConnectors({
  layout,
  colW,
  activePath,
}: {
  layout: BracketLayout;
  colW: number;
  activePath: Set<string> | null;
}) {
  const width = layout.cols * colW + (layout.cols - 1) * GUTTER;
  const height = layout.rows * ROW_H;
  const centre = (p: { start: number; end: number }) => ((p.start + p.end) / 2) * ROW_H;

  const paths: { d: string; lit: boolean; key: string }[] = [];

  for (const parent of layout.placed) {
    const feeders = layout.feeders.get(parent.node.id) ?? [];
    if (feeders.length === 0) continue;

    const px = parent.col * (colW + GUTTER);
    const py = centre(parent);
    const railX = px - GUTTER / 2;

    for (const fid of feeders) {
      const f = layout.byId.get(fid);
      if (!f) continue;
      const fx = f.col * (colW + GUTTER) + colW;
      const fy = centre(f);
      const lit = Boolean(activePath?.has(fid) && activePath.has(parent.node.id));

      let d: string;
      if (Math.abs(fy - py) < 1) {
        d = `M ${fx} ${fy} L ${px} ${py}`;
      } else {
        const dir = py > fy ? 1 : -1;
        const r = Math.min(RADIUS, Math.abs(py - fy) / 2, GUTTER / 2);
        d =
          `M ${fx} ${fy} L ${railX - r} ${fy} ` +
          `Q ${railX} ${fy} ${railX} ${fy + dir * r} ` +
          `L ${railX} ${py - dir * r} ` +
          `Q ${railX} ${py} ${railX + r} ${py} ` +
          `L ${px} ${py}`;
      }
      paths.push({ d, lit, key: `${fid}->${parent.node.id}` });
    }
  }

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
      width={width}
      height={height}
    >
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={
            p.lit
              ? "stroke-primary transition-[stroke,stroke-width] duration-200"
              : "stroke-border transition-[stroke,stroke-width] duration-200"
          }
          strokeWidth={p.lit ? 2.5 : 1.5}
        />
      ))}
    </svg>
  );
}
