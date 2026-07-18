"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Client tab switcher for the Leaderboard. Both panels are pre-rendered on the
 * server and passed in as props, so switching tabs needs no refetch and the
 * existing Prediction Leaderboard is untouched.
 */
export function LeaderboardTabs({
  prediction,
  standings,
}: {
  prediction: React.ReactNode;
  standings: React.ReactNode;
}) {
  const [tab, setTab] = useState<"prediction" | "standings">("prediction");

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-2xl border border-border/60 bg-card/60 p-1.5">
        {[
          { key: "prediction", label: "🏆 Prediction Leaderboard" },
          { key: "standings", label: "🎮 Tournament Standings" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={cn(
              "flex-1 rounded-xl px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              tab === t.key && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "prediction" ? prediction : standings}
    </div>
  );
}
