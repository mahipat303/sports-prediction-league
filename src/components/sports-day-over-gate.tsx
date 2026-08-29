"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

const DISMISS_KEY = "sportsDayOver.gate";

/** Rotating sarcastic quips — one is picked at random on mount. (We're on
 *  Azure DevOps, so the work items live in ADO, not Jira.) */
const LINES = [
  "The bracket is closed. Your ADO board, however, is wide open. 👀",
  "Those Azure DevOps work items aren't going to close themselves, champ. ⏳",
  "Great predictions. Even better would be moving that story to \"Done\". 📋",
  "Standup is in a few minutes and you have… vibes to report. 🧍",
  "The scoreboard is frozen. Your sprint velocity should not be. 🏃",
  "You called every winner correctly. Now estimate that PBI you've been dodging. 🔮",
];

export function SportsDayOverGate() {
  const [visible, setVisible] = useState(false);
  const [line, setLine] = useState(LINES[0]);

  useEffect(() => {
    // Deferred so the state reads don't run synchronously inside the effect.
    const raf = requestAnimationFrame(() => {
      let dismissed = false;
      try {
        dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
      } catch {
        /* sessionStorage unavailable — show it */
      }
      if (!dismissed) {
        setLine(LINES[Math.floor(Math.random() * LINES.length)]);
        setVisible(true);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Lock background scroll while the gate is up.
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  function proceed() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sports Day is over"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-y-auto bg-[#0a0e1f] px-6 py-10 text-center text-white"
    >
      {/* ambient lighting */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-amber-500/20 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-pink-600/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[28rem] w-[28rem] rounded-full bg-indigo-600/15 blur-[120px]" />
      </div>

      <div className="relative flex max-w-3xl flex-col items-center">
        <div className="mb-4 text-7xl sm:text-8xl">🏁</div>
        <p className="text-lg font-semibold uppercase tracking-[0.35em] text-white/50 sm:text-2xl">
          That&apos;s a wrap
        </p>
        <h1 className="mt-3 bg-gradient-to-br from-amber-200 via-white to-pink-200 bg-clip-text text-6xl font-black leading-[1.02] tracking-tight text-transparent sm:text-8xl">
          Sports Day
          <br />
          is OVER
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/70 sm:text-2xl">{line}</p>
        <p className="mt-4 text-base text-white/40 sm:text-lg">
          Go on. Get back to your actual job. 💼
        </p>
      </div>

      {/* Continue */}
      <div className="relative mt-10 flex flex-col items-center gap-3">
        <p className="max-w-md text-sm text-white/50 sm:text-base">
          Besides all your pending work… if you&apos;re shameless enough, you may continue to use this app.
        </p>
        <button
          type="button"
          onClick={proceed}
          className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-pink-500 px-8 py-4 text-lg font-bold text-black shadow-lg transition-transform hover:scale-[1.04] sm:text-xl"
        >
          Fine, I&apos;m shameless — continue
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
