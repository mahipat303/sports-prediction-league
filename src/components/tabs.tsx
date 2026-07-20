"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  key: string;
  label: string;
  content: React.ReactNode;
}

/**
 * Shared tab switcher. Panels are pre-rendered on the server and passed in,
 * so switching needs no refetch. Used by the Leaderboard and My Predictions.
 */
export function Tabs({
  items,
  initial,
  className,
}: {
  items: TabItem[];
  initial?: string;
  className?: string;
}) {
  const [active, setActive] = useState(initial ?? items[0]?.key);
  const current = items.find((i) => i.key === active) ?? items[0];

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex gap-1 rounded-2xl border border-border/60 bg-card/60 p-1.5">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => setActive(item.key)}
            className={cn(
              "flex-1 rounded-xl px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              active === item.key &&
                "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {current?.content}
    </div>
  );
}
