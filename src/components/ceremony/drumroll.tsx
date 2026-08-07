"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The "AND THE WINNER IS…" build-up shown before a reveal. The countdown value
 * (3 → 2 → 1) is driven by the parent so it stays in step with the audio cue
 * and the confetti burst. The champion build-up is rendered larger.
 */
export function Drumroll({
  count,
  champion,
  message = "And the winner is…",
}: {
  count: number | null;
  champion?: boolean;
  message?: string;
}) {
  return (
    <div className="flex min-h-[20rem] flex-col items-center justify-center gap-5 text-center sm:min-h-[26rem]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-7xl sm:text-8xl"
      >
        🥁
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 1.2 }}
        className="text-2xl font-semibold uppercase tracking-[0.3em] text-white/70 sm:text-4xl"
      >
        {message}
      </motion.p>
      <AnimatePresence mode="popLayout">
        {count !== null && count > 0 && (
          <motion.div
            key={count}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 2.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className={cn(
              "bg-gradient-to-br bg-clip-text font-black text-transparent",
              champion
                ? "from-amber-300 to-yellow-500 text-[10rem] leading-none sm:text-[16rem]"
                : "from-amber-300 to-pink-400 text-9xl sm:text-[12rem]"
            )}
          >
            {count}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
