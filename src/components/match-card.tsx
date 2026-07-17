"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Clock, Lock, Zap, HelpCircle, Radio } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { cn, formatDateTime, CONFIDENCE_META } from "@/lib/utils";
import { submitPrediction } from "@/app/actions";

export interface MatchCardSide {
  label: string;
  teamName: string | null;
  teamShortName: string | null;
  color: string | null;
  players: string[];
  specialBadge: string | null;
  pickCount: number;
}

type ConfidencePreview = Record<string, { correct: number; wrong: number }>;

export interface MatchCardFixture {
  id: string;
  sportName: string;
  sportIcon: string | null;
  matchCategory: string;
  stage: string | null;
  status: string;
  isPlaceholder: boolean;
  isOpen: boolean; // predictions currently accepted (computed server-side)
  startTime: string;
  lockTime: string;
  venue: string | null;
  liveUrl: string | null;
  scoreSummary: string | null;
  winnerSide: number | null;
  winnerPoints: number;
  confidencePreview: ConfidencePreview;
  side1: MatchCardSide;
  side2: MatchCardSide;
  myPrediction: {
    side: number;
    confidence: string;
    isCorrect: boolean | null;
    points: number;
  } | null;
  isLoggedIn: boolean;
}

const FALLBACK_COLORS = ["#6366f1", "#ec4899"];
const WINNER_EMOJIS = ["🏆", "😎", "🎉", "🔥", "👑", "💪"];
const LOSER_EMOJIS = ["😭", "🤡", "💀", "😵", "😅", "🙈"];

// Deterministic emoji per fixture+side so it doesn't reshuffle on every render.
function pickEmoji(list: string[], seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return list[Math.abs(h) % list.length];
}

function SideButton({
  side,
  n,
  fixture,
  selected,
  pending,
  totalPicks,
  onPick,
}: {
  side: MatchCardSide;
  n: 1 | 2;
  fixture: MatchCardFixture;
  selected: number | null;
  pending: boolean;
  totalPicks: number;
  onPick: (side: number) => void;
}) {
  const isSelected = selected === n;
  const isDone = fixture.status === "COMPLETED";
  const isWinner = isDone && fixture.winnerSide === n;
  const isLoser = isDone && fixture.winnerSide != null && fixture.winnerSide !== n;
  const pct = totalPicks ? Math.round((side.pickCount / totalPicks) * 100) : 0;
  const color = side.color ?? FALLBACK_COLORS[n - 1];
  const clickable = fixture.isOpen && fixture.isLoggedIn && !pending;

  return (
    <button
      disabled={!clickable}
      onClick={() => onPick(n)}
      className={cn(
        "group relative flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition-all",
        isSelected ? "border-transparent shadow-lg" : "border-border/60 bg-background/30",
        clickable && "cursor-pointer hover:scale-[1.02] hover:shadow-md",
        isWinner && "ring-2 ring-emerald-500",
        isLoser && "opacity-60"
      )}
      style={
        isSelected
          ? { backgroundColor: `${color}1f`, borderColor: color }
          : undefined
      }
    >
      {isWinner && (
        <motion.span
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 12 }}
          className="absolute -top-3 right-1 text-xl drop-shadow"
        >
          {pickEmoji(WINNER_EMOJIS, fixture.id + n)}
        </motion.span>
      )}
      {isLoser && (
        <span className="absolute -top-3 right-1 text-lg opacity-80">
          {pickEmoji(LOSER_EMOJIS, fixture.id + n)}
        </span>
      )}
      {fixture.isPlaceholder && !side.teamName ? (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <HelpCircle className="h-5 w-5 text-muted-foreground" />
        </span>
      ) : (
        <Avatar name={side.label} color={color} className="h-12 w-12 text-sm" />
      )}
      <div>
        <p className="text-sm font-semibold leading-tight">{side.label}</p>
        {side.specialBadge && (
          <span className="mt-0.5 inline-block rounded-full bg-gradient-to-r from-amber-400/20 to-pink-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-300">
            {side.specialBadge}
          </span>
        )}
        {side.teamName && (
          <p className="mt-0.5 text-[11px] font-medium" style={{ color }}>
            {side.teamName}
          </p>
        )}
      </div>
      {totalPicks > 0 && (
        <div className="w-full">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{pct}% picked</p>
        </div>
      )}
    </button>
  );
}

export function MatchCard({ fixture }: { fixture: MatchCardFixture }) {
  const [selected, setSelected] = useState<number | null>(
    fixture.myPrediction?.side ?? null
  );
  const [confidence, setConfidence] = useState(
    fixture.myPrediction?.confidence ?? "LOW"
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const isOpen = fixture.isOpen;
  const isDone = fixture.status === "COMPLETED";
  const isLive = fixture.status === "LIVE";
  const totalPicks = fixture.side1.pickCount + fixture.side2.pickCount;
  const preview = fixture.confidencePreview[confidence] ?? { correct: 0, wrong: 0 };

  function save(side: number, level = confidence) {
    setSelected(side);
    const formData = new FormData();
    formData.set("fixtureId", fixture.id);
    formData.set("side", String(side));
    formData.set("confidence", level);
    startTransition(async () => {
      const result = await submitPrediction(formData);
      if (result?.error) {
        setMessage(result.error);
        setSelected(fixture.myPrediction?.side ?? null);
      } else {
        setMessage("Prediction saved ✓");
        confetti({ particleCount: 40, spread: 55, origin: { y: 0.7 }, scalar: 0.8 });
        setTimeout(() => setMessage(null), 2500);
      }
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">
              {fixture.sportIcon ?? "🏅"} {fixture.sportName}
            </Badge>
            <Badge variant="outline">{fixture.matchCategory}</Badge>
            {fixture.stage && <Badge variant="outline">{fixture.stage}</Badge>}
            {fixture.winnerPoints > 0 && (
              <Badge variant="warning">🏆 {fixture.winnerPoints} pts</Badge>
            )}
            <span className="ml-auto flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" /> {formatDateTime(fixture.startTime)}
            </span>
            {isLive && <Badge variant="live">● LIVE</Badge>}
            {isDone && <Badge variant="success">Final</Badge>}
            {!isOpen && !isDone && !isLive && (
              <Badge variant="warning">
                <Lock className="h-3 w-3" />
                {fixture.isPlaceholder ? "Awaiting qualifiers" : "Locked"}
              </Badge>
            )}
          </div>

          <div className="flex items-stretch gap-3">
            <SideButton
              side={fixture.side1}
              n={1}
              fixture={fixture}
              selected={selected}
              pending={pending}
              totalPicks={totalPicks}
              onPick={save}
            />
            <div className="flex flex-col items-center justify-center text-xs font-bold text-muted-foreground">
              VS
              {fixture.scoreSummary && (
                <span className="mt-1 whitespace-nowrap rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                  {fixture.scoreSummary}
                </span>
              )}
            </div>
            <SideButton
              side={fixture.side2}
              n={2}
              fixture={fixture}
              selected={selected}
              pending={pending}
              totalPicks={totalPicks}
              onPick={save}
            />
          </div>

          {/* Watch Live link */}
          {fixture.liveUrl && (isLive || isOpen || !isDone) && (
            <a href={fixture.liveUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block">
              <Button
                className="w-full gap-2 bg-red-600 text-white hover:bg-red-700"
                size="sm"
              >
                <Radio className="h-4 w-4 animate-pulse" /> Watch Live
              </Button>
            </a>
          )}

          {isOpen && fixture.isLoggedIn && (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Zap className="h-3 w-3" /> Confidence:
                </span>
                {Object.entries(CONFIDENCE_META).map(([level, meta]) => (
                  <Button
                    key={level}
                    size="sm"
                    variant={confidence === level ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => {
                      setConfidence(level);
                      if (selected) save(selected, level);
                    }}
                    disabled={pending}
                  >
                    {meta.label} {meta.multiplier}
                  </Button>
                ))}
                {message && (
                  <span className="text-xs font-medium text-emerald-500">{message}</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {CONFIDENCE_META[confidence]?.label} confidence:{" "}
                <span className="font-semibold text-emerald-500">+{preview.correct}</span> if right
                {preview.wrong < 0 ? (
                  <>
                    {" · "}
                    <span className="font-semibold text-red-500">{preview.wrong}</span> if wrong
                  </>
                ) : (
                  <> · no penalty if wrong</>
                )}
              </p>
            </div>
          )}

          {isOpen && !fixture.isLoggedIn && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Sign in to make a prediction
            </p>
          )}

          {fixture.myPrediction?.isCorrect != null && (
            <p
              className={cn(
                "mt-3 text-center text-sm font-semibold",
                fixture.myPrediction.isCorrect ? "text-emerald-500" : "text-red-500"
              )}
            >
              {fixture.myPrediction.isCorrect
                ? `You predicted right! +${fixture.myPrediction.points} pts 🎉`
                : fixture.myPrediction.points < 0
                  ? `Ouch — that miss cost you ${fixture.myPrediction.points} pts 😵`
                  : "Your prediction missed this time 🙈"}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
