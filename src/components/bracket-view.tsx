"use client";

import { useState } from "react";
import { Trophy, Radio, Users, Lock, ChevronDown } from "lucide-react";
import type { Bracket, BracketNode, BracketSide } from "@/lib/bracket";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import {
  BracketNodeCard,
  STATE_META,
  nodeState,
} from "@/components/bracket/bracket-node";
import { BracketConnectors } from "@/components/bracket/bracket-connectors";
import {
  useBracketLayout,
  CARD_H,
  COL_W,
  GUTTER,
  ROW_H,
} from "@/components/bracket/use-bracket-layout";

/** One competitor block in the details modal. */
function DetailSide({ s, won }: { s: BracketSide; won: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-2.5",
        won ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/60 bg-background/40"
      )}
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        {s.teamColor && (
          <span
            className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: s.teamColor }}
          />
        )}
        <span className="min-w-0 flex-1 break-words">{s.label}</span>
        {won && <Trophy className="h-4 w-4 flex-shrink-0 text-amber-500" />}
      </p>
      {s.teamName && <p className="mt-0.5 text-[11px] text-muted-foreground">{s.teamName}</p>}
      {s.players.length > 0 && (
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Users className="h-3 w-3 flex-shrink-0" /> {s.players.join(", ")}
        </p>
      )}
    </div>
  );
}

function DetailModal({ node, onClose }: { node: BracketNode | null; onClose: () => void }) {
  if (!node) return null;
  const state = nodeState(node);
  const w = node.winnerSide;
  const rows: [string, React.ReactNode][] = [
    ["Stage", node.stage ?? "—"],
    ["Category", node.matchCategory],
    ["Status", STATE_META[state].label],
    ["Date & time", `${formatDateTime(node.startTime)} IST`],
  ];
  if (node.venue) rows.push(["Venue", node.venue]);
  if (node.status === "COMPLETED") {
    rows.push(["Winner", w ? (w === 1 ? node.side1.label : node.side2.label) : "—"]);
    if (node.scoreSummary) rows.push(["Score", node.scoreSummary]);
    if (node.isUpset) rows.push(["Upset", "Yes — the underdog won"]);
  } else {
    rows.push([
      "Predictions",
      node.isPlaceholder
        ? "Closed — participants not decided yet"
        : node.status === "SCHEDULED"
          ? "Open"
          : "Closed",
    ]);
  }
  rows.push(["Predictions made", String(node.predictionCount)]);

  return (
    <Modal open onClose={onClose} title="Match details" className="max-w-md">
      <div className="space-y-3 text-sm">
        <div className="space-y-1.5">
          <DetailSide s={node.side1} won={w === 1} />
          <p className="text-center text-[10px] font-bold text-muted-foreground">vs</p>
          <DetailSide s={node.side2} won={w === 2} />
        </div>
        <dl className="space-y-1 rounded-xl border border-border/60 p-3">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-32 flex-shrink-0 text-xs text-muted-foreground">{k}</dt>
              <dd className="min-w-0 flex-1 text-xs">{v}</dd>
            </div>
          ))}
        </dl>
        {node.liveUrl && node.status !== "COMPLETED" && (
          <a href={node.liveUrl} target="_blank" rel="noopener noreferrer" className="block">
            <Button size="sm" className="w-full gap-1.5 bg-red-600 text-white hover:bg-red-700">
              <Radio className="h-3.5 w-3.5 animate-pulse" /> Watch Live
            </Button>
          </a>
        )}
        <Button variant="outline" className="w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

function roundLabel(bracket: Bracket, i: number) {
  const stages = [...new Set(bracket.rounds[i].map((n) => n.stage).filter(Boolean))];
  return stages.length === 1 ? stages[0]! : `Round ${i + 1}`;
}

/** Desktop: true bracket — rounds as columns, elbow connectors between them. */
function BracketCanvas({
  bracket,
  onOpen,
}: {
  bracket: Bracket;
  onOpen: (n: BracketNode) => void;
}) {
  const layout = useBracketLayout(bracket);
  const [hovered, setHovered] = useState<string | null>(null);

  // Hovering a match lights its whole route through the bracket, in both
  // directions — where these players came from and where the winner goes on to.
  const activePath = hovered ? (layout.lineage.get(hovered) ?? null) : null;

  const lastCol = layout.cols - 1;

  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="relative"
        style={{
          width: layout.cols * COL_W + (layout.cols - 1) * GUTTER,
          height: layout.rows * ROW_H + 26,
        }}
      >
        {/* round headers */}
        {bracket.rounds.map((_, i) => (
          <div
            key={`h${i}`}
            className="absolute top-0 flex items-center gap-2"
            style={{ left: i * (COL_W + GUTTER), width: COL_W }}
          >
            <span
              className={cn(
                "truncate text-[10px] font-bold uppercase tracking-[0.12em]",
                i === lastCol ? "text-primary" : "text-muted-foreground"
              )}
            >
              {i === lastCol && layout.cols > 1 ? "🏆 " : ""}
              {roundLabel(bracket, i)}
            </span>
            <span aria-hidden className="h-px flex-1 bg-border/70" />
          </div>
        ))}

        <div className="absolute left-0" style={{ top: 26 }}>
          <BracketConnectors layout={layout} colW={COL_W} activePath={activePath} />

          {layout.placed.map((p) => (
            <div
              key={p.node.id}
              className="absolute animate-in-up"
              style={{
                left: p.col * (COL_W + GUTTER),
                top: ((p.start + p.end) / 2) * ROW_H - CARD_H / 2,
                width: COL_W,
                minHeight: CARD_H,
                animationDelay: `${p.col * 60}ms`,
              }}
            >
              <BracketNodeCard
                node={p.node}
                isFinal={p.col === lastCol && layout.cols > 1}
                lit={Boolean(activePath?.has(p.node.id))}
                dimmed={Boolean(activePath && !activePath.has(p.node.id))}
                onOpen={() => onOpen(p.node)}
                onHover={setHovered}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Mobile: the same rounds stacked vertically, so no connector can overlap. */
function BracketStack({
  bracket,
  onOpen,
}: {
  bracket: Bracket;
  onOpen: (n: BracketNode) => void;
}) {
  const lastCol = bracket.rounds.length - 1;
  return (
    <div className="space-y-1">
      {bracket.rounds.map((round, i) => (
        <div key={i}>
          <div className="mb-1.5 mt-2 flex items-center gap-2">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-[0.12em]",
                i === lastCol ? "text-primary" : "text-muted-foreground"
              )}
            >
              {i === lastCol && bracket.rounds.length > 1 ? "🏆 " : ""}
              {roundLabel(bracket, i)}
            </span>
            <span aria-hidden className="h-px flex-1 bg-border/70" />
          </div>
          <div className="space-y-1.5">
            {round.map((n) => (
              <BracketNodeCard
                key={n.id}
                node={n}
                isFinal={i === lastCol && bracket.rounds.length > 1}
                lit={false}
                dimmed={false}
                onOpen={() => onOpen(n)}
                onHover={() => {}}
              />
            ))}
          </div>
          {i < lastCol && (
            <div className="flex justify-center py-0.5" aria-hidden>
              <ChevronDown className="h-4 w-4 text-border" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function BracketView({ brackets }: { brackets: Bracket[] }) {
  const [selected, setSelected] = useState<BracketNode | null>(null);

  if (brackets.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/60 p-10 text-center text-sm text-muted-foreground">
        No matches for these filters. 🔍
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {brackets.map((b) => {
        const all = b.rounds.flat();
        const done = all.filter((n) => n.status === "COMPLETED").length;
        const waiting = all.filter((n) => n.isPlaceholder).length;
        const pct = all.length ? Math.round((done / all.length) * 100) : 0;
        return (
          <section
            key={b.key}
            className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card/70 to-card/30 shadow-sm"
          >
            <header className="flex flex-wrap items-center gap-2 border-b border-border/50 px-3 py-2.5 sm:px-4">
              <h3 className="text-sm font-bold tracking-tight">{b.matchCategory}</h3>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {done}/{all.length}
              </Badge>
              {all.some((n) => n.status === "LIVE") && <Badge variant="live">Live</Badge>}
              {waiting > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Lock className="h-3 w-3" /> {waiting} awaiting
                </span>
              )}
              <div className="ml-auto hidden h-1 w-24 overflow-hidden rounded-full bg-muted sm:block">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </header>

            <div className="hidden px-3 pt-3 sm:block sm:px-4">
              <BracketCanvas bracket={b} onOpen={setSelected} />
            </div>
            <div className="px-3 pb-3 sm:hidden">
              <BracketStack bracket={b} onOpen={setSelected} />
            </div>
          </section>
        );
      })}
      <DetailModal node={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
