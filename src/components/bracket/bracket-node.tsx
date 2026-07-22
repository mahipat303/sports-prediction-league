"use client";

import { Trophy, Lock, Radio } from "lucide-react";
import type { BracketNode, BracketSide } from "@/lib/bracket";
import { cn, formatDateTime } from "@/lib/utils";

export type NodeState = "completed" | "live" | "waiting" | "upcoming";

export function nodeState(n: BracketNode): NodeState {
  if (n.status === "COMPLETED") return "completed";
  if (n.status === "LIVE") return "live";
  if (n.isPlaceholder) return "waiting";
  return "upcoming";
}

export const STATE_META: Record<
  NodeState,
  { label: string; dot: string; accent: string; card: string }
> = {
  completed: {
    label: "Completed",
    dot: "bg-emerald-500",
    accent: "bg-emerald-500",
    card: "border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.07] to-transparent",
  },
  live: {
    label: "Live",
    dot: "bg-red-500 animate-pulse",
    accent: "bg-red-500",
    card: "border-red-500/40 bg-gradient-to-br from-red-500/[0.08] to-transparent",
  },
  upcoming: {
    label: "Upcoming",
    dot: "bg-sky-500",
    accent: "bg-sky-500/70",
    card: "border-border/60 bg-card/70",
  },
  waiting: {
    label: "Waiting on an earlier match",
    dot: "bg-muted-foreground/50",
    accent: "bg-muted-foreground/30",
    card: "border-dashed border-border bg-card/40",
  },
};

function SideRow({
  side,
  isWinner,
  isLoser,
  score,
}: {
  side: BracketSide;
  isWinner: boolean;
  isLoser: boolean;
  score?: string | null;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md px-1.5 py-[3px] text-xs leading-tight transition-colors",
        isWinner && "bg-emerald-500/10 font-semibold text-foreground",
        isLoser && "text-muted-foreground",
        side.pending && "italic text-muted-foreground"
      )}
    >
      {side.teamColor ? (
        <span
          className="h-2 w-2 flex-shrink-0 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: side.teamColor }}
        />
      ) : (
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-muted" />
      )}
      <span className="min-w-0 flex-1 truncate">{side.label}</span>
      {score && <span className="font-mono text-[10px] text-muted-foreground">{score}</span>}
      {isWinner && <Trophy className="h-3 w-3 flex-shrink-0 text-amber-500" />}
    </div>
  );
}

export function BracketNodeCard({
  node,
  isFinal,
  dimmed,
  lit,
  onOpen,
  onHover,
}: {
  node: BracketNode;
  isFinal: boolean;
  dimmed: boolean;
  lit: boolean;
  onOpen: () => void;
  onHover: (id: string | null) => void;
}) {
  const state = nodeState(node);
  const meta = STATE_META[state];
  const w = node.winnerSide;

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(node.id)}
      onBlur={() => onHover(null)}
      aria-label={`${node.stage ?? "Match"}: ${node.side1.label} versus ${node.side2.label}. ${meta.label}.`}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-xl border text-left shadow-sm",
        "transition-[transform,box-shadow,border-color,opacity] duration-200",
        "hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        meta.card,
        isFinal && "ring-1 ring-primary/40 shadow-primary/10",
        lit && "border-primary/60 shadow-md",
        dimmed && "opacity-55 saturate-50"
      )}
    >
      {/* status accent rail */}
      <span aria-hidden className={cn("absolute left-0 top-0 h-full w-[3px]", meta.accent)} />

      <div className="flex items-center gap-1.5 px-2 pl-2.5 pt-1.5">
        <span aria-hidden className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", meta.dot)} />
        <span className="truncate text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {isFinal && "🏆 "}
          {node.stage ?? "Match"}
        </span>
        <span className="ml-auto flex items-center gap-1 whitespace-nowrap text-[9px] text-muted-foreground">
          {state === "waiting" && <Lock className="h-2.5 w-2.5" />}
          {state === "live" && <Radio className="h-2.5 w-2.5 animate-pulse text-red-500" />}
          {formatDateTime(node.startTime).replace(",", "")}
        </span>
      </div>

      <div className="space-y-px px-1.5 pb-1.5 pl-2.5 pt-1">
        <SideRow
          side={node.side1}
          isWinner={w === 1}
          isLoser={w === 2}
          score={w === 1 ? node.scoreSummary : null}
        />
        <SideRow
          side={node.side2}
          isWinner={w === 2}
          isLoser={w === 1}
          score={w === 2 ? node.scoreSummary : null}
        />
      </div>
    </button>
  );
}
