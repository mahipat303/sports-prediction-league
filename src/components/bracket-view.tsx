"use client";

import { useState } from "react";
import { Trophy, Radio, Users, Lock } from "lucide-react";
import type { Bracket, BracketNode, BracketSide } from "@/lib/bracket";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";

type NodeState = "completed" | "live" | "waiting" | "upcoming";

function nodeState(n: BracketNode): NodeState {
  if (n.status === "COMPLETED") return "completed";
  if (n.status === "LIVE") return "live";
  if (n.isPlaceholder) return "waiting";
  return "upcoming";
}

const STATE_META: Record<NodeState, { label: string; dot: string; ring: string }> = {
  completed: { label: "🟢 Completed", dot: "bg-emerald-500", ring: "border-emerald-500/40" },
  live: { label: "🟡 Live", dot: "bg-amber-500 animate-pulse", ring: "border-amber-500/60" },
  waiting: { label: "🔒 Waiting for previous match", dot: "bg-muted-foreground/40", ring: "border-dashed border-border" },
  upcoming: { label: "⚪ Upcoming", dot: "bg-slate-400", ring: "border-border/60" },
};

function SideRow({ side, isWinner, isLoser }: { side: BracketSide; isWinner: boolean; isLoser: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs",
        isWinner && "bg-emerald-500/10 font-semibold",
        isLoser && "opacity-55",
        side.pending && "italic text-muted-foreground"
      )}
    >
      {side.teamColor && (
        <span
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{ backgroundColor: side.teamColor }}
        />
      )}
      <span className="min-w-0 flex-1 truncate">{side.label}</span>
      {isWinner && <Trophy className="h-3 w-3 flex-shrink-0 text-amber-500" />}
    </div>
  );
}

function NodeCard({ node, onOpen }: { node: BracketNode; onOpen: () => void }) {
  const state = nodeState(node);
  const meta = STATE_META[state];
  const w = node.winnerSide;
  return (
    <button
      onClick={onOpen}
      className={cn(
        "w-full rounded-xl border bg-card/70 p-2 text-left shadow-sm backdrop-blur transition-colors hover:border-primary/60 hover:bg-accent/60",
        meta.ring
      )}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", meta.dot)} />
        <span className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
          {node.stage ?? "Match"}
        </span>
        {node.scoreSummary && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {node.scoreSummary}
          </span>
        )}
      </div>
      <SideRow side={node.side1} isWinner={w === 1} isLoser={w === 2} />
      <SideRow side={node.side2} isWinner={w === 2} isLoser={w === 1} />
    </button>
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
    ["Date & time", formatDateTime(node.startTime) + " IST"],
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
        <div className="space-y-1.5 rounded-xl border border-border/60 p-3">
          {([node.side1, node.side2] as const).map((s, i) => (
            <div key={i}>
              <SideRow side={s} isWinner={w === i + 1} isLoser={Boolean(w) && w !== i + 1} />
              {s.teamName && (
                <p className="pl-3 text-[11px] text-muted-foreground">{s.teamName}</p>
              )}
              {s.players.length > 0 && (
                <p className="flex items-center gap-1 pl-3 text-[11px] text-muted-foreground">
                  <Users className="h-3 w-3" /> {s.players.join(", ")}
                </p>
              )}
              {i === 0 && <p className="py-0.5 text-center text-[10px] font-bold text-muted-foreground">vs</p>}
            </div>
          ))}
        </div>
        <dl className="space-y-1">
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
        <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}

/** One sport+category bracket: rounds as columns (stacked rows on mobile). */
function BracketGrid({ bracket, onOpen }: { bracket: Bracket; onOpen: (n: BracketNode) => void }) {
  const roundLabel = (i: number) => {
    const stages = [...new Set(bracket.rounds[i].map((n) => n.stage).filter(Boolean))];
    return stages.length === 1 ? stages[0]! : `Round ${i + 1}`;
  };
  return (
    <div className="overflow-x-auto pb-1">
      <div
        className="grid min-w-max gap-x-6 gap-y-3"
        style={{ gridTemplateColumns: `repeat(${bracket.rounds.length}, minmax(9.5rem, 13rem))` }}
      >
        {bracket.rounds.map((_, i) => (
          <div key={`h${i}`} className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {roundLabel(i)}
          </div>
        ))}
        {bracket.rounds.map((round, i) => (
          <div
            key={`c${i}`}
            className={cn(
              "flex flex-col gap-2",
              // Later rounds centre against the taller column feeding them.
              i > 0 && "justify-center"
            )}
          >
            {round.map((n) => (
              <div key={n.id} className="relative">
                {i > 0 && (
                  // Connector rail into this node from the previous column.
                  <span
                    aria-hidden
                    className="pointer-events-none absolute right-full top-1/2 h-px w-6 bg-border"
                  />
                )}
                <NodeCard node={n} onOpen={() => onOpen(n)} />
              </div>
            ))}
          </div>
        ))}
      </div>
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
    <div className="space-y-6">
      {brackets.map((b) => {
        const all = b.rounds.flat();
        const done = all.filter((n) => n.status === "COMPLETED").length;
        return (
          <section key={b.key} className="rounded-2xl border border-border/60 bg-card/40 p-3 sm:p-4">
            <header className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold">{b.matchCategory}</h3>
              <Badge variant="secondary">
                {done}/{all.length} played
              </Badge>
              {all.some((n) => n.status === "LIVE") && <Badge variant="live">Live now</Badge>}
              {all.some((n) => n.isPlaceholder) && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  {all.filter((n) => n.isPlaceholder).length} awaiting earlier results
                </span>
              )}
            </header>
            <BracketGrid bracket={b} onOpen={setSelected} />
          </section>
        );
      })}
      <DetailModal node={selected} onClose={() => setSelected(null)} />
    </div>
  );
}


