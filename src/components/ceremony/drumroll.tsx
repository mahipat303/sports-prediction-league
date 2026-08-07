"use client";

import { AnimatePresence, motion } from "framer-motion";

/**
 * The "AND THE WINNER IS…" build-up shown before a reveal. The countdown value
 * (3 → 2 → 1) is driven by the parent so it stays in step with keyboard
 * control and the confetti burst.
 */
export function Drumroll({ count }: { count: number | null }) {
  return (
    <div className="flex min-h-[16rem] flex-col items-center justify-center gap-4 text-center sm:min-h-[22rem]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-6xl sm:text-7xl"
      >
        🥁
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 1.2 }}
        className="text-lg font-semibold uppercase tracking-[0.3em] text-white/70 sm:text-2xl"
      >
        And the winner is…
      </motion.p>
      <AnimatePresence mode="popLayout">
        {count !== null && count > 0 && (
          <motion.div
            key={count}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 2.2, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="bg-gradient-to-br from-amber-300 to-pink-400 bg-clip-text text-8xl font-black text-transparent sm:text-9xl"
          >
            {count}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
