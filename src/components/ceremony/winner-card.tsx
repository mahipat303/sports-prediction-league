"use client";

import { motion } from "framer-motion";
import { Trophy, Medal } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Premium winner card. Photo-free by design: a large coloured-initials avatar
 * (there are no player photos in the system), team colour, name, category and
 * a champion / runner-up badge. Animated entrance.
 */
export function WinnerCard({
  place,
  name,
  subtitle,
  teamName,
  teamColor,
  score,
  delay = 0,
}: {
  place: "champion" | "runnerUp" | "third";
  name: string;
  subtitle?: string;
  teamName?: string | null;
  teamColor?: string | null;
  score?: string | null;
  delay?: number;
}) {
  const meta = {
    champion: { label: "Champion", ring: "ring-amber-400/60", glow: "shadow-[0_0_60px_-12px] shadow-amber-400/50", icon: <Trophy className="h-6 w-6 text-amber-400" />, medal: "🥇" },
    runnerUp: { label: "Runner-up", ring: "ring-slate-300/50", glow: "shadow-[0_0_50px_-16px] shadow-slate-300/40", icon: <Medal className="h-6 w-6 text-slate-300" />, medal: "🥈" },
    third: { label: "Third place", ring: "ring-orange-400/50", glow: "shadow-[0_0_50px_-16px] shadow-orange-400/40", icon: <Medal className="h-6 w-6 text-orange-400" />, medal: "🥉" },
  }[place];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 20, delay }}
      className={cn(
        "relative flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl sm:p-8",
        "ring-2",
        meta.ring,
        meta.glow
      )}
    >
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-3xl">{meta.medal}</div>
      <Avatar
        name={name}
        color={teamColor ?? undefined}
        className="h-24 w-24 text-3xl sm:h-32 sm:w-32 sm:text-4xl"
      />
      <div className="text-center">
        <p className="flex items-center justify-center gap-2 text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
          {name}
        </p>
        {teamName && (
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm font-medium sm:text-base" style={{ color: teamColor ?? undefined }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: teamColor ?? "currentColor" }} />
            {teamName}
          </p>
        )}
        {subtitle && <p className="mt-1 text-xs text-white/50 sm:text-sm">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white">
        {meta.icon} {meta.label}
        {score && <span className="ml-1 font-mono text-xs text-white/60">· {score}</span>}
      </div>
    </motion.div>
  );
}
