"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Sparkles, Maximize, PartyPopper, Volume2, VolumeX,
} from "lucide-react";
import type { CeremonyData, CategoryAward, TeamAward, PredictionAward } from "@/lib/ceremony";
import type { CustomAward } from "@/lib/ceremony-config";
import { CountUp } from "./count-up";
import { Confetti } from "./confetti";
import { Fireworks } from "./fireworks";
import { Drumroll } from "./drumroll";
import { HeroWinner, type Place } from "./winner-card";
import { useCeremonySound } from "./use-ceremony-sound";
import { cn } from "@/lib/utils";

type Slide =
  | { kind: "opening" }
  | { kind: "sportsMonth" }
  | { kind: "recap" }
  | { kind: "categoryIntro"; award: CategoryAward }
  | { kind: "presenter"; award: CategoryAward }
  | { kind: "reveal"; award: CategoryAward; place: "runnerUp" | "champion" }
  | { kind: "predReveal"; pred: PredictionAward; place: Place }
  | { kind: "teamPresenter"; place: Place }
  | { kind: "teamReveal"; team: TeamAward; place: Place }
  | { kind: "customReveal"; award: CustomAward }
  | { kind: "closing" };

type Phase = "pre" | "counting" | "shown";

const isRevealSlide = (s: Slide) =>
  s.kind === "reveal" || s.kind === "teamReveal" || s.kind === "predReveal" || s.kind === "customReveal";
const isChampionReveal = (s: Slide) =>
  (s.kind === "reveal" && s.place === "champion") ||
  ((s.kind === "teamReveal" || s.kind === "predReveal") && s.place === "champion");

/** Which configured sound cue fires for this reveal (for custom audio URLs). */
function cueForSlide(s: Slide): string {
  if (s.kind === "reveal") return s.place === "champion" ? "champion" : "runnerUp";
  if (s.kind === "teamReveal") return s.place === "champion" ? "teamChampion" : "runnerUp";
  if (s.kind === "predReveal") return s.place === "champion" ? "champion" : "runnerUp";
  if (s.kind === "customReveal") return "funny";
  return "champion";
}

export function CeremonyDeck({ data }: { data: CeremonyData }) {
  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = [{ kind: "opening" }, { kind: "sportsMonth" }, { kind: "recap" }];
    for (const award of data.categoryAwards) {
      out.push({ kind: "categoryIntro", award });
      out.push({ kind: "presenter", award });
      if (award.runnerUp) out.push({ kind: "reveal", award, place: "runnerUp" });
      out.push({ kind: "reveal", award, place: "champion" });
    }
    // Predictions, then teams — each revealed 3rd → 2nd → 1st for the build-up.
    const predPodium = data.predictionAwards.slice(0, 3);
    for (const pred of [...predPodium].reverse()) {
      out.push({
        kind: "predReveal",
        pred,
        place: pred.rank === 1 ? "champion" : pred.rank === 2 ? "runnerUp" : "third",
      });
    }
    const teamPodium = data.teamAwards.slice(0, 3);
    for (const team of [...teamPodium].reverse()) {
      const place: Place = team.rank === 1 ? "champion" : team.rank === 2 ? "runnerUp" : "third";
      out.push({ kind: "teamPresenter", place });
      out.push({ kind: "teamReveal", team, place });
    }
    for (const award of data.customAwards) out.push({ kind: "customReveal", award });
    out.push({ kind: "closing" });
    return out;
  }, [data]);

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("pre");
  const [count, setCount] = useState<number | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [fireworksKey, setFireworksKey] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sound = useCeremonySound(data.sound);

  const slide = slides[index];
  const isReveal = isRevealSlide(slide);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    clearTimers();
    sound.stopRoll();
    const raf = requestAnimationFrame(() => {
      setCount(null);
      setPhase(isReveal ? "pre" : "shown");
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, isReveal]);

  const celebrate = useCallback((champion: boolean) => {
    setConfettiKey((k) => k + 1);
    if (champion) setFireworksKey((k) => k + 1);
  }, []);

  const runReveal = useCallback(() => {
    if (phase !== "pre") return;
    const champion = isChampionReveal(slide);
    setPhase("counting");
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPhase("shown");
      celebrate(champion);
      sound.playReveal(cueForSlide(slide));
      sound.playApplause();
      return;
    }
    // Champion gets a slower, longer build-up for extra suspense.
    const step = champion ? 1000 : 800;
    const suspense = champion ? 700 : 300;
    sound.startRoll();
    [3, 2, 1].forEach((n, i) => {
      timers.current.push(
        setTimeout(() => {
          setCount(n);
          sound.playTick();
        }, i * step)
      );
    });
    timers.current.push(
      setTimeout(() => {
        setCount(null);
        setPhase("shown");
        sound.stopRoll();
        sound.playReveal(cueForSlide(slide));
        celebrate(champion);
        timers.current.push(setTimeout(() => sound.playApplause(), 250));
      }, 3 * step + suspense)
    );
  }, [phase, slide, celebrate, sound]);

  const skip = useCallback(() => {
    clearTimers();
    sound.stopRoll();
    setCount(null);
    setPhase((p) => {
      if (p === "counting") {
        celebrate(isChampionReveal(slide));
        sound.playReveal(cueForSlide(slide));
      }
      return "shown";
    });
  }, [slide, celebrate, sound]);

  const next = useCallback(() => setIndex((i) => Math.min(slides.length - 1, i + 1)), [slides.length]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Number keys jump to the major sections.
  const jump = useCallback(
    (n: number) => {
      const find = (pred: (s: Slide) => boolean) => slides.findIndex(pred);
      const map: Record<number, number> = {
        1: 0,
        2: find((s) => s.kind === "recap"),
        3: find((s) => s.kind === "categoryIntro"),
        4: find((s) => s.kind === "predReveal"),
        5: find((s) => s.kind === "teamPresenter"),
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
          setConfettiKey((k) => k + 1);
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
        case "m":
        case "M":
          sound.toggleMuted();
          break;
        default:
          if (/^[1-6]$/.test(e.key)) jump(Number(e.key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, isReveal, phase, runReveal, skip, toggleFullscreen, jump, sound]);

  const nudge = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3500);
  }, []);
  useEffect(() => {
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
      className="fixed inset-0 z-[60] overflow-hidden bg-[#0a0e1f] text-white"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-pink-600/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[28rem] w-[28rem] rounded-full bg-amber-500/10 blur-[120px]" />
      </div>

      <Fireworks burstKey={fireworksKey} />
      <Confetti burstKey={confettiKey} />

      <motion.div
        key={index}
        initial={{ opacity: 0, scale: 0.96, filter: "blur(6px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative z-10 mx-auto flex h-full max-w-6xl flex-col items-center justify-center px-8 py-10"
      >
        <SlideBody
          slide={slide}
          data={data}
          phase={phase}
          count={count}
          champion={isChampionReveal(slide)}
          onReveal={runReveal}
        />
      </motion.div>

      <div aria-hidden className="fixed left-0 top-0 z-40 h-1 w-full bg-white/5">
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-400 to-pink-400"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

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
        <Ctl onClick={() => setConfettiKey((k) => k + 1)} label="Confetti (C)">
          <Sparkles className="h-5 w-5" />
        </Ctl>
        <Ctl onClick={sound.toggleMuted} label={sound.muted ? "Unmute (M)" : "Mute (M)"}>
          {sound.muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </Ctl>
        <button
          type="button"
          onClick={sound.cycleStyle}
          title="Sound style (fun / classic)"
          aria-label={`Sound style: ${sound.style}`}
          className="flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10"
        >
          {sound.style === "fun" ? "🤪 Fun" : "🥁 Classic"}
        </button>
        <Ctl onClick={toggleFullscreen} label="Fullscreen (F)">
          <Maximize className="h-5 w-5" />
        </Ctl>
      </motion.div>
    </div>
  );
}

function Ctl({
  children, onClick, label, primary, disabled,
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

/**
 * Short, stage-friendly presenter invitation. The name is generic for now
 * (`presenter` is undefined); per-category presenter names arrive with the
 * Phase-2 admin config and slot straight into `presenter`.
 */
function PresenterSlide({ context, presenter }: { context: string; presenter?: string }) {
  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 16 }}
        className="mb-6 text-7xl sm:text-8xl"
      >
        🎤
      </motion.div>
      {presenter ? (
        <>
          <p className="text-xl uppercase tracking-[0.3em] text-white/50 sm:text-2xl">Please welcome</p>
          <h1 className="mt-3 bg-gradient-to-br from-amber-200 to-pink-200 bg-clip-text text-6xl font-black tracking-tight text-transparent sm:text-8xl">
            {presenter}
          </h1>
          <p className="mt-6 text-2xl text-white/70 sm:text-3xl">to present the awards.</p>
        </>
      ) : (
        <>
          <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-snug tracking-tight text-white sm:text-7xl">
            Please welcome our presenter to the stage
          </h1>
          <p className="mt-6 text-xl text-white/50 sm:text-2xl">to present {context}.</p>
        </>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-lg font-semibold uppercase tracking-[0.2em] text-white/80 backdrop-blur sm:text-xl">
      {children}
    </div>
  );
}

function RevealShell({
  chip, phase, count, champion, message, onReveal, cta, children,
}: {
  chip: React.ReactNode;
  phase: Phase;
  count: number | null;
  champion: boolean;
  message: string;
  onReveal: () => void;
  cta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col items-center text-center">
      <Chip>{chip}</Chip>
      {phase !== "shown" ? (
        <div className="flex flex-col items-center">
          <Drumroll count={count} champion={champion} message={message} />
          {phase === "pre" && (
            <button
              onClick={onReveal}
              className="mt-6 rounded-full bg-white px-10 py-4 text-xl font-bold text-black transition-transform hover:scale-105"
            >
              {cta}
            </button>
          )}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function SlideBody({
  slide, data, phase, count, champion, onReveal,
}: {
  slide: Slide;
  data: CeremonyData;
  phase: Phase;
  count: number | null;
  champion: boolean;
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
            className="mb-6 text-8xl sm:text-9xl"
          >
            🏆
          </motion.div>
          <p className="text-lg font-semibold uppercase tracking-[0.4em] text-white/50 sm:text-2xl">
            Welcome to
          </p>
          <h1 className="mt-4 bg-gradient-to-br from-white via-indigo-200 to-pink-200 bg-clip-text text-6xl font-black leading-[1.05] tracking-tight text-transparent sm:text-8xl">
            {data.tournamentName}
          </h1>
          <p className="mt-3 text-4xl font-bold text-white/80 sm:text-6xl">Awards Day</p>
          {data.speeches.opening && (
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/70 sm:text-2xl">
              {data.speeches.opening}
            </p>
          )}
          <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="mt-14 text-base uppercase tracking-[0.3em] text-white/60 sm:text-lg"
          >
            Press Space or → to begin
          </motion.p>
        </div>
      );

    case "sportsMonth": {
      const monthName = data.tournamentName.replace(/day/i, "Month");
      return (
        <div className="text-center">
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="mb-6 text-8xl sm:text-9xl"
          >
            😅
          </motion.div>
          <p className="text-2xl font-semibold text-white/70 sm:text-4xl">Oops…</p>
          <p className="mt-3 text-xl text-white/50 sm:text-2xl">
            Looks like we got the name a little wrong.
          </p>
          <p className="mt-8 text-2xl text-white/60 sm:text-3xl">
            It wasn&apos;t <span className="text-white/40 line-through decoration-red-400/70 decoration-4">Sports Day</span> …
          </p>
          <motion.h1
            initial={{ scale: 0.4, opacity: 0, rotate: -6 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 12, delay: 0.6 }}
            className="mt-5 bg-gradient-to-br from-amber-200 via-white to-pink-200 bg-clip-text text-6xl font-black tracking-tight text-transparent sm:text-8xl"
          >
            🏆 {monthName} 😂
          </motion.h1>
          <p className="mt-8 text-base text-white/40 sm:text-lg">
            …a whole month of sport. Worth it.
          </p>
        </div>
      );
    }

    case "recap": {
      const r = data.recap;
      const tiles = [
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
          <h2 className="mb-10 text-5xl font-black tracking-tight sm:text-7xl">
            Sports Day {data.year}, by the numbers
          </h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl sm:p-8">
                <p className="bg-gradient-to-br from-white to-indigo-200 bg-clip-text text-6xl font-black text-transparent sm:text-7xl">
                  <CountUp value={t.value} suffix={t.suffix} />
                </p>
                <p className="mt-2 text-sm uppercase tracking-wide text-white/50 sm:text-base">{t.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left backdrop-blur">
                <span className="text-3xl">{f.emoji}</span>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-white/50 sm:text-sm">{f.label}</p>
                  <p className="truncate text-lg font-semibold sm:text-xl">{f.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "categoryIntro": {
      const a = slide.award;
      return (
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="mb-6 text-8xl sm:text-9xl"
          >
            {a.sportIcon}
          </motion.div>
          <p className="text-xl font-semibold uppercase tracking-[0.3em] text-white/50 sm:text-2xl">{a.sport}</p>
          <h1 className="mt-3 bg-gradient-to-br from-white via-indigo-200 to-pink-200 bg-clip-text text-6xl font-black leading-tight tracking-tight text-transparent sm:text-8xl">
            {a.category}
          </h1>
        </div>
      );
    }

    case "presenter":
      return (
        <PresenterSlide
          context={`${slide.award.sport} · ${slide.award.category}`}
          presenter={slide.award.presenter ?? undefined}
        />
      );

    case "teamPresenter":
      return (
        <PresenterSlide
          context="the Team Awards"
          presenter={data.teamPresenters[slide.place] ?? undefined}
        />
      );

    case "reveal": {
      const a = slide.award;
      const isChamp = slide.place === "champion";
      const winner = isChamp ? a.champion : a.runnerUp!;
      return (
        <RevealShell
          chip={<><span>{a.sportIcon}</span> {a.sport} · {a.category}</>}
          phase={phase}
          count={count}
          champion={champion}
          message={isChamp ? "And the Champion is…" : "And our Runner-up is…"}
          onReveal={onReveal}
          cta={isChamp ? "Reveal the Champion 🏆" : "Reveal the Runner-up 🥈"}
        >
          <HeroWinner
            place={isChamp ? "champion" : "runnerUp"}
            name={winner.label}
            teamName={winner.teamName}
            teamColor={winner.teamColor}
            score={isChamp ? a.score : null}
            subtitle={a.description || (isChamp && a.isUpset ? "Upset victory 💥" : null)}
          />
        </RevealShell>
      );
    }

    case "customReveal": {
      const a = slide.award;
      return (
        <RevealShell
          chip={<>{a.emoji} Special Award</>}
          phase={phase}
          count={count}
          champion={champion}
          message="And it goes to…"
          onReveal={onReveal}
          cta={`Reveal ${a.title} ${a.emoji}`}
        >
          <div className="text-center">
            <p className="mb-4 text-2xl font-bold uppercase tracking-[0.2em] text-white/60 sm:text-3xl">
              {a.emoji} {a.title}
            </p>
            <HeroWinner
              place="champion"
              name={a.winner}
              teamName={a.team ?? null}
              subtitle={a.subtitle ?? null}
            />
          </div>
        </RevealShell>
      );
    }

    case "teamReveal": {
      const t = slide.team;
      const place = slide.place;
      return (
        <RevealShell
          chip={<>🏅 Team Standings</>}
          phase={phase}
          count={count}
          champion={champion}
          message={
            place === "champion" ? "And the Champion team is…"
            : place === "runnerUp" ? "Our Runner-up team is…"
            : "In third place…"
          }
          onReveal={onReveal}
          cta={
            place === "champion" ? "Reveal the Champion Team 🏆"
            : place === "runnerUp" ? "Reveal the Runner-up Team 🥈"
            : "Reveal Third Place 🥉"
          }
        >
          <HeroWinner
            place={place}
            name={t.name}
            teamColor={t.color}
            subtitle={`${t.points} pts · ${t.championships} 🏆 · ${t.runnerUps} 🥈`}
          />
        </RevealShell>
      );
    }

    case "predReveal": {
      const p = slide.pred;
      const place = slide.place;
      return (
        <RevealShell
          chip={<>🎯 Prediction League</>}
          phase={phase}
          count={count}
          champion={champion}
          message={
            place === "champion" ? "And the Prediction Champion is…"
            : place === "runnerUp" ? "Our Runner-up is…"
            : "In third place…"
          }
          onReveal={onReveal}
          cta={
            place === "champion" ? "Reveal the Prediction Champion 🏆"
            : place === "runnerUp" ? "Reveal the Runner-up 🥈"
            : "Reveal Third Place 🥉"
          }
        >
          <HeroWinner
            place={place}
            name={p.name}
            subtitle={`${p.totalPoints} pts · ${p.accuracy}% · ${p.correct}W / ${p.wrong}L`}
          />
        </RevealShell>
      );
    }

    case "closing":
      return (
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="mb-6 text-8xl sm:text-9xl"
          >
            🎉
          </motion.div>
          <h1 className="bg-gradient-to-br from-white via-indigo-200 to-pink-200 bg-clip-text text-6xl font-black tracking-tight text-transparent sm:text-8xl">
            Thank You, Everyone
          </h1>
          <p className="mt-6 text-3xl font-bold text-white/80 sm:text-4xl">{data.tournamentName}</p>
          {data.speeches.closing ? (
            <p className="mx-auto mt-6 max-w-2xl text-xl text-white/70 sm:text-2xl">{data.speeches.closing}</p>
          ) : (
            <p className="mt-8 text-xl text-white/60 sm:text-2xl">See you next year ❤️</p>
          )}
        </div>
      );
  }
}
