"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

const DISMISS_KEY = "sportsDayOver.gate";
const NAG_INTERVAL_MS = 15_000;

/** Quips for the first, blocking gate. (We're on Azure DevOps, not Jira.) */
const GATE_LINES = [
  "The bracket is closed. Your ADO board, however, is wide open. 👀",
  "Those Azure DevOps work items aren't going to close themselves, champ. ⏳",
  "Great predictions. Even better would be moving that story to \"Done\". 📋",
  "Standup is in a few minutes and you have… vibes to report. 🧍",
  "The scoreboard is frozen. Your sprint velocity should not be. 🏃",
  "You called every winner correctly. Now estimate that PBI you've been dodging. 🔮",
];

/** Roasts for the every-15-seconds nag once the shameless one keeps browsing. */
const NAG_LINES = [
  "So you're THIS free, huh? Shame on you. 😏",
  "Still here? Your ADO board is quietly judging you. 🙈",
  "Wow — not one work item moved, and you're back on the leaderboard? Bold. 😌",
  "So much free time! Your manager would LOVE to hear about it. 👀",
  "Shameless. Truly. Anyway… the sprint is still running. ⏳",
  "You again? At this point just assign yourself a ticket. 🎫",
  "Zero commits today, unlimited scrolling. Iconic. 💀",
];

type Phase = "gate" | "hidden" | "nag";

export function SportsDayOverGate() {
  const [phase, setPhase] = useState<Phase>("hidden");
  const [line, setLine] = useState(GATE_LINES[0]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rand = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  // After the gate/nag is dismissed, come back to shame them again in 15s.
  const scheduleNag = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLine(rand(NAG_LINES));
      setPhase("nag");
    }, NAG_INTERVAL_MS);
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      let dismissed = false;
      try {
        dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
      } catch {
        /* sessionStorage unavailable — show the gate */
      }
      if (dismissed) {
        // Already got past the gate this session — just keep nagging.
        scheduleNag();
      } else {
        setLine(rand(GATE_LINES));
        setPhase("gate");
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [scheduleNag]);

  // Lock background scroll whenever the overlay is up.
  useEffect(() => {
    if (phase === "hidden") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  const proceed = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setPhase("hidden");
    scheduleNag();
  }, [scheduleNag]);

  if (phase === "hidden") return null;

  const isNag = phase === "nag";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isNag ? "Back to work" : "Sports Day is over"}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-y-auto bg-[#0a0e1f] px-6 py-10 text-center text-white"
    >
      {/* ambient lighting */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-amber-500/20 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-pink-600/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[28rem] w-[28rem] rounded-full bg-indigo-600/15 blur-[120px]" />
      </div>

      <div className="relative flex max-w-3xl flex-col items-center">
        <div className="mb-4 text-7xl sm:text-8xl">{isNag ? "😒" : "🏁"}</div>
        <p className="text-lg font-semibold uppercase tracking-[0.35em] text-white/50 sm:text-2xl">
          {isNag ? "Seriously?" : "That's a wrap"}
        </p>
        <h1 className="mt-3 bg-gradient-to-br from-amber-200 via-white to-pink-200 bg-clip-text text-6xl font-black leading-[1.02] tracking-tight text-transparent sm:text-8xl">
          {isNag ? (
            <>
              So free,
              <br />
              huh?
            </>
          ) : (
            <>
              Sports Day
              <br />
              is OVER
            </>
          )}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/70 sm:text-2xl">{line}</p>
        <p className="mt-4 text-base text-white/40 sm:text-lg">
          Go on. Get back to your actual job. 💼
        </p>
      </div>

      {/* Continue */}
      <div className="relative mt-10 flex flex-col items-center gap-3">
        <p className="max-w-md text-sm text-white/50 sm:text-base">
          {isNag
            ? "We'll ask again in 15 seconds. Shame doesn't take breaks."
            : "Besides all your pending work… if you're shameless enough, you may continue to use this app."}
        </p>
        <button
          type="button"
          onClick={proceed}
          className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-pink-500 px-8 py-4 text-lg font-bold text-black shadow-lg transition-transform hover:scale-[1.04] sm:text-xl"
        >
          {isNag ? "Yeah yeah — let me back in" : "Fine, I'm shameless — continue"}
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
