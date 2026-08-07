"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Sparkles, Maximize, PartyPopper, Trophy, Target,
} from "lucide-react";
import type { CeremonyData, CategoryAward } from "@/lib/ceremony";
import { CountUp } from "./count-up";
import { Confetti } from "./confetti";
import { Drumroll } from "./drumroll";
import { WinnerCard } from "./winner-card";
import { cn } from "@/lib/utils";

type Slide =
  | { kind: "opening" }
  | { kind: "recap" }
  | { kind: "award"; award: CategoryAward }
  | { kind: "teams" }
  | { kind: "predictions" }
  | { kind: "closing" };

type Phase = "pre" | "counting" | "shown";

const CHAPTER_ICON: Record<string, React.ReactNode> = {
  recap: <Sparkles className="h-4 w-4" />,
  awards: <Trophy className="h-4 w-4" />,
  teams: <Trophy className="h-4 w-4" />,
  predictions: <Target className="h-4 w-4" />,
};

export function CeremonyDeck({ data }: { data: CeremonyData }) {
  const slides = useMemo<Slide[]>(
    () => [
      { kind: "opening" },
      { kind: "recap" },
      ...data.categoryAwards.map((award) => ({ kind: "award", award }) as Slide),
      { kind: "teams" },
      { kind: "predictions" },
      { kind: "closing" },
    ],
    [data]
  );

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("pre");
  const [count, setCount] = useState<number | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slide = slides[index];
  const isReveal = slide.kind === "award" || slide.kind === "teams" || slide.kind === "predictions";

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // Reset the reveal state whenever the slide changes; reveal slides start
  // hidden, everything else is immediately "shown". Deferred so the state
  // updates don't run synchronously inside the effect.
  useEffect(() => {
    clearTimers();
    const raf = requestAnimationFrame(() => {
      setCount(null);
      setPhase(isReveal ? "pre" : "shown");
    });
    return () => cancelAnimationFrame(raf);
  }, [index, isReveal]);

  const burst = useCallback(() => setConfettiKey((k) => k + 1), []);

  const runReveal = useCallback(() => {
    if (phase !== "pre") return;
    setPhase("counting");
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPhase("shown");
      burst();
      return;
    }
    [3, 2, 1].forEach((n, i) => {
      timers.current.push(setTimeout(() => setCount(n), i * 800));
    });
    timers.current.push(
      setTimeout(() => {
        setCount(null);
        setPhase("shown");
        burst();
      }, 3 * 800)
    );
  }, [phase, burst]);

  const skip = useCallback(() => {
    clearTimers();
    setCount(null);
    setPhase("shown");
  }, []);

  const next = useCallback(() => {
    setIndex((i) => Math.min(slides.length - 1, i + 1));
  }, [slides.length]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Section jump targets for number keys: 1 opening, 2 recap, 3 awards,
  // 4 teams, 5 predictions, 6 closing.
  const jump = useCallback(
    (n: number) => {
      const firstAward = slides.findIndex((s) => s.kind === "award");
      const map: Record<number, number> = {
        1: 0,
        2: slides.findIndex((s) => s.kind === "recap"),
        3: firstAward,
        4: slides.findIndex((s) => s.kind === "teams"),
        5: slides.findIndex((s) => s.kind === "predictions"),
        6: slides.length - 1,
      };
      if (map[n] != null && map[n] >= 0) setIndex(map[n]);
    },
    [slides]
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prev();
          break;
        case " ":
          e.preventDefault();
          if (isReveal && phase === "pre") runReveal();
          else if (isReveal && phase === "counting") skip();
          else next();
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "c":
        case "C":
          burst();
          break;
        case "s":
        case "S":
          skip();
          break;
        case "r":
        case "R":
          setPhase("pre");
          setCount(null);
          break;
        default:
          if (/^[1-6]$/.test(e.key)) jump(Number(e.key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, isReveal, phase, runReveal, skip, toggleFullscreen, burst, jump]);

  // Auto-hide the controls after a few seconds of no mouse movement.
  const nudge = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3500);
  }, []);
  useEffect(() => {
    // Re-show the controls on each slide change, then schedule the auto-hide.
    // Deferred so we don't call setState synchronously inside the effect.
    const raf = requestAnimationFrame(nudge);
    return () => {
      cancelAnimationFrame(raf);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [index, nudge]);

  const progress = ((index + 1) / slides.length) * 100;

  return (
    <div
      onMouseMove={nudge}
      // Fixed full-viewport overlay so the ceremony covers the app chrome
      // (navbar/footer) for a true keynote, without touching the root layout.
      className="fixed inset-0 z-[60] overflow-y-auto bg-[#0a0e1f] text-white"
    >
      {/* ambient lighting */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-pink-600/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[28rem] w-[28rem] rounded-full bg-amber-500/10 blur-[120px]" />
      </div>

      <Confetti burstKey={confettiKey} />

      {/* Keyed entrance only — no exit-wait, so a stalled exit can never leave
          the presenter stuck between slides. */}
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 mx-auto flex min-h-[100dvh] max-w-5xl flex-col items-center justify-center px-6 py-16"
      >
        <SlideBody
          slide={slide}
          data={data}
          phase={phase}
          count={count}
          onReveal={runReveal}
        />
      </motion.div>

      {/* progress rail */}
      <div aria-hidden className="fixed left-0 top-0 z-40 h-1 w-full bg-white/5">
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-400 to-pink-400"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* controls */}
      <motion.div
        animate={{ opacity: controlsVisible ? 1 : 0 }}
        className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2 py-1.5 backdrop-blur-xl"
      >
        <Ctl onClick={prev} label="Previous" disabled={index === 0}>
          <ChevronLeft className="h-5 w-5" />
        </Ctl>
        <span className="px-2 text-xs tabular-nums text-white/60">
          {index + 1} / {slides.length}
        </span>
        {isReveal && phase === "pre" ? (
          <Ctl onClick={runReveal} label="Reveal" primary>
            <PartyPopper className="h-5 w-5" />
          </Ctl>
        ) : (
          <Ctl onClick={next} label="Next" disabled={index === slides.length - 1} primary>
            <ChevronRight className="h-5 w-5" />
          </Ctl>
        )}
        <Ctl onClick={burst} label="Confetti (C)">
          <Sparkles className="h-5 w-5" />
        </Ctl>
        <Ctl onClick={toggleFullscreen} label="Fullscreen (F)">
          <Maximize className="h-5 w-5" />
        </Ctl>
      </motion.div>
    </div>
  );
}

function Ctl({
  children,
  onClick,
  label,
  primary,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:opacity-30",
        primary ? "bg-white text-black hover:bg-white/90" : "text-white/80 hover:bg-white/10"
      )}
    >
      {children}
    </button>
  );
}

function Chapter({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
      {icon}
      {children}
    </div>
  );
}

function SlideBody({
  slide,
  data,
  phase,
  count,
  onReveal,
}: {
  slide: Slide;
  data: CeremonyData;
  phase: Phase;
  count: number | null;
  onReveal: () => void;
}) {
  switch (slide.kind) {
    case "opening":
      return (
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="mb-6 text-7xl sm:text-8xl"
          >
            🏆
          </motion.div>
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-white/50">Welcome to</p>
          <h1 className="mt-3 bg-gradient-to-br from-white via-indigo-200 to-pink-200 bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-7xl">
            {data.tournamentName}
          </h1>
          <p className="mt-2 text-2xl font-bold text-white/80 sm:text-4xl">Awards Night</p>
          <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="mt-12 text-sm uppercase tracking-[0.3em] text-white/60"
          >
            Press Space or → to begin
          </motion.p>
        </div>
      );

    case "recap": {
      const r = data.recap;
      const tiles: { label: string; value: number; suffix?: string; decimals?: number; sub?: string }[] = [
        { label: "Players", value: r.totalPlayers },
        { label: "Matches", value: r.totalMatches },
        { label: "Predictions", value: r.totalPredictions },
        { label: "Prediction accuracy", value: r.predictionAccuracy, suffix: "%" },
      ];
      const facts: { emoji: string; label: string; value: string }[] = [];
      if (r.mostPredicted) facts.push({ emoji: "🎯", label: "Most predicted", value: `${r.mostPredicted.label} (${r.mostPredicted.count})` });
      if (r.longestStreak) facts.push({ emoji: "🔥", label: "Longest streak", value: `${r.longestStreak.name} · ${r.longestStreak.streak}` });
      if (r.mvp) facts.push({ emoji: "⭐", label: "MVP", value: `${r.mvp.name} · ${r.mvp.won}/${r.mvp.played} W` });
      if (r.biggestUpset) facts.push({ emoji: "💥", label: "Biggest upset", value: `${r.biggestUpset.label} (${r.biggestUpset.sport})` });
      if (r.championPoints) facts.push({ emoji: "🏆", label: "Top team", value: `${r.championPoints.name} · ${r.championPoints.points} pts` });
      return (
        <div className="w-full text-center">
          <Chapter icon={CHAPTER_ICON.recap}>Sports Day {data.year} · Recap</Chapter>
          <h2 className="mb-10 text-4xl font-black tracking-tight sm:text-5xl">By the numbers</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <p className="bg-gradient-to-br from-white to-indigo-200 bg-clip-text text-4xl font-black text-transparent sm:text-5xl">
                  <CountUp value={t.value} suffix={t.suffix} decimals={t.decimals} />
                </p>
                <p className="mt-1 text-xs uppercase tracking-wide text-white/50">{t.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left backdrop-blur">
                <span className="text-2xl">{f.emoji}</span>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-white/50">{f.label}</p>
                  <p className="truncate font-semibold">{f.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "award": {
      const a = slide.award;
      return (
        <div className="w-full text-center">
          <Chapter icon={<span>{a.sportIcon}</span>}>
            {a.sport} · {a.category}
          </Chapter>
          {phase !== "shown" ? (
            <div>
              <Drumroll count={count} />
              {phase === "pre" && (
                <button
                  onClick={onReveal}
                  className="mt-4 rounded-full bg-white px-8 py-3 font-bold text-black transition-transform hover:scale-105"
                >
                  Reveal the champion 🎉
                </button>
              )}
            </div>
          ) : (
            <div className="mx-auto grid max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
              <WinnerCard
                place="champion"
                name={a.champion.label}
                teamName={a.champion.teamName}
                teamColor={a.champion.teamColor}
                score={a.score}
                subtitle={a.isUpset ? "Upset victory 💥" : undefined}
              />
              {a.runnerUp && (
                <WinnerCard
                  place="runnerUp"
                  name={a.runnerUp.label}
                  teamName={a.runnerUp.teamName}
                  teamColor={a.runnerUp.teamColor}
                  delay={0.15}
                />
              )}
            </div>
          )}
        </div>
      );
    }

    case "teams": {
      const podium = data.teamAwards.slice(0, 3);
      const places: ("champion" | "runnerUp" | "third")[] = ["champion", "runnerUp", "third"];
      return (
        <div className="w-full text-center">
          <Chapter icon={CHAPTER_ICON.teams}>Team Standings</Chapter>
          <h2 className="mb-8 text-4xl font-black tracking-tight sm:text-5xl">🏅 Sports Day Champions</h2>
          {phase !== "shown" ? (
            <div>
              <Drumroll count={count} />
              {phase === "pre" && (
                <button onClick={onReveal} className="mt-4 rounded-full bg-white px-8 py-3 font-bold text-black transition-transform hover:scale-105">
                  Reveal the winning team 🏆
                </button>
              )}
            </div>
          ) : (
            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3">
              {podium.map((t, i) => (
                <WinnerCard
                  key={t.teamId}
                  place={places[i]}
                  name={t.name}
                  teamColor={t.color}
                  subtitle={`${t.points} pts · ${t.championships}🏆 ${t.runnerUps}🥈`}
                  delay={i * 0.15}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    case "predictions": {
      const podium = data.predictionAwards;
      const places: ("champion" | "runnerUp" | "third")[] = ["champion", "runnerUp", "third"];
      return (
        <div className="w-full text-center">
          <Chapter icon={CHAPTER_ICON.predictions}>Prediction League</Chapter>
          <h2 className="mb-8 text-4xl font-black tracking-tight sm:text-5xl">🎯 Top Predictors</h2>
          {phase !== "shown" ? (
            <div>
              <Drumroll count={count} />
              {phase === "pre" && (
                <button onClick={onReveal} className="mt-4 rounded-full bg-white px-8 py-3 font-bold text-black transition-transform hover:scale-105">
                  Reveal the prediction champion 🏆
                </button>
              )}
            </div>
          ) : (
            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3">
              {podium.map((p, i) => (
                <WinnerCard
                  key={p.name + p.rank}
                  place={places[i]}
                  name={p.name}
                  subtitle={`${p.totalPoints} pts · ${p.accuracy}% · ${p.correct}W/${p.wrong}L`}
                  delay={i * 0.15}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    case "closing":
      return (
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="mb-6 text-7xl sm:text-8xl"
          >
            🎉
          </motion.div>
          <h1 className="bg-gradient-to-br from-white via-indigo-200 to-pink-200 bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-7xl">
            Thank You, Everyone
          </h1>
          <p className="mt-4 text-2xl font-bold text-white/80">{data.tournamentName}</p>
          <p className="mt-8 text-lg text-white/60">See you next year ❤️</p>
        </div>
      );
  }
}
