"use client";

import { motion } from "framer-motion";
import { Trophy, Medal } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type Place = "champion" | "runnerUp" | "third";

const META: Record<
  Place,
  { label: string; medal: string; ring: string; glow: string; accent: string }
> = {
  champion: {
    label: "Champion",
    medal: "🥇",
    ring: "ring-amber-400/70",
    glow: "shadow-[0_0_120px_-20px] shadow-amber-400/60",
    accent: "from-amber-300 to-yellow-500",
  },
  runnerUp: {
    label: "Runner-up",
    medal: "🥈",
    ring: "ring-slate-300/60",
    glow: "shadow-[0_0_80px_-24px] shadow-slate-300/40",
    accent: "from-slate-200 to-slate-400",
  },
  third: {
    label: "Third place",
    medal: "🥉",
    ring: "ring-orange-400/60",
    glow: "shadow-[0_0_80px_-24px] shadow-orange-400/40",
    accent: "from-orange-300 to-amber-600",
  },
};

/**
 * A single winner shown large and centred — one per slide now, so each finalist
 * gets their own moment. The champion variant adds a gold spotlight, a stronger
 * glow and an animated badge. Photo-free: a big coloured-initials avatar.
 */
export function HeroWinner({
  place,
  name,
  teamName,
  teamColor,
  subtitle,
  score,
}: {
  place: Place;
  name: string;
  teamName?: string | null;
  teamColor?: string | null;
  subtitle?: string | null;
  score?: string | null;
}) {
  const meta = META[place];
  const isChampion = place === "champion";

  return (
    <div className="relative flex flex-col items-center">
      {isChampion && (
        <>
          {/* gold spotlight cone */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0, scaleY: 0.6 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.6 }}
            className="pointer-events-none absolute -top-24 h-[130%] w-[70%] origin-top bg-gradient-to-b from-amber-300/25 via-amber-300/5 to-transparent blur-2xl"
          />
        </>
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="relative flex flex-col items-center gap-5"
      >
        {/* medal badge */}
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.15 }}
          className="text-5xl sm:text-6xl"
        >
          {meta.medal}
        </motion.div>

        <Avatar
          name={name}
          color={teamColor ?? undefined}
          className={cn(
            "ring-4",
            meta.ring,
            meta.glow,
            isChampion
              ? "h-44 w-44 text-6xl sm:h-56 sm:w-56 sm:text-7xl"
              : "h-36 w-36 text-5xl sm:h-44 sm:w-44 sm:text-6xl"
          )}
        />

        <div className="text-center">
          <h3
            className={cn(
              "font-black leading-tight tracking-tight text-white",
              isChampion ? "text-6xl sm:text-8xl" : "text-5xl sm:text-7xl"
            )}
          >
            {name}
          </h3>
          {teamName && (
            <p
              className="mt-2 flex items-center justify-center gap-2 text-xl font-semibold sm:text-2xl"
              style={{ color: teamColor ?? undefined }}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: teamColor ?? "currentColor" }}
              />
              {teamName}
            </p>
          )}
          {subtitle && (
            <p className="mt-2 text-base text-white/60 sm:text-xl">{subtitle}</p>
          )}
        </div>

        <div
          className={cn(
            "flex items-center gap-2 rounded-full px-6 py-2.5 text-lg font-bold sm:text-xl",
            "bg-gradient-to-r text-black",
            meta.accent
          )}
        >
          {isChampion ? <Trophy className="h-6 w-6" /> : <Medal className="h-6 w-6" />}
          {meta.label}
          {score && <span className="font-mono text-sm opacity-70">· {score}</span>}
        </div>
      </motion.div>
    </div>
  );
}
