"use client";

import { useEffect, useState } from "react";
import { X, Briefcase } from "lucide-react";

const DISMISS_KEY = "sportsDayOver.dismissed";

/** Rotating sarcastic sign-offs — one is picked at random on mount. */
const LINES = [
  "Congrats on the predictions, superstar. Now those Jira tickets aren't going to close themselves. 💼",
  "The tournament bracket is done. Your sprint backlog… is not. Chop chop. 🏃",
  "Great job cheering. Even better job would be shipping that PR you've been \"reviewing\" since Tuesday. 👀",
  "Medals distributed. Deadlines undeterred. Back to the grind, champ. ⏳",
  "The only standing left is your daily standup. Get to it. 🧍",
  "You predicted the winners flawlessly. Now predict when that ticket will actually be done. 🔮",
];

export function SportsDayOverBanner() {
  const [visible, setVisible] = useState(false);
  const [line, setLine] = useState(LINES[0]);

  useEffect(() => {
    // Deferred so the state reads don't run synchronously inside the effect.
    const raf = requestAnimationFrame(() => {
      let dismissed = false;
      try {
        dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
      } catch {
        /* sessionStorage unavailable — just show it */
      }
      if (!dismissed) {
        setLine(LINES[Math.floor(Math.random() * LINES.length)]);
        setVisible(true);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  function dismiss() {
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
      role="status"
      className="relative mb-5 overflow-hidden rounded-2xl border-2 border-amber-400/40 bg-gradient-to-r from-amber-400/15 via-pink-500/10 to-indigo-500/15 p-4 shadow-sm sm:p-5"
    >
      {/* glow blobs */}
      <div aria-hidden className="pointer-events-none absolute -left-8 -top-10 h-24 w-24 rounded-full bg-amber-400/20 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-10 -right-6 h-28 w-28 rounded-full bg-pink-400/20 blur-2xl" />

      <button
        type="button"
        onClick={dismiss}
        aria-label="Fine, I'll get back to work"
        className="absolute right-2 top-2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative flex items-start gap-3 pr-6">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-pink-500 text-white shadow">
          <Briefcase className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold tracking-tight sm:text-base">
            🏁 Sports Day is over, brother.
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{line}</p>
          <button
            type="button"
            onClick={dismiss}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-pink-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            Ugh, fine — back to work 😮‍💨
          </button>
        </div>
      </div>
    </div>
  );
}
