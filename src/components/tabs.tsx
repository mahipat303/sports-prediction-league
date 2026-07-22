"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export interface TabItem {
  key: string;
  label: string;
  content: React.ReactNode;
}

/**
 * Shared tab switcher. Panels are pre-rendered on the server and passed in,
 * so switching needs no refetch. Used by the Leaderboard and My Predictions.
 *
 * Pass `param` to store the active tab in that URL search param instead of
 * local state. That is required on pages whose filters also navigate (the
 * admin pages): with local state, a filter change re-renders the page and the
 * active tab could be lost. URL-backed tabs are also linkable and survive a
 * refresh. Without `param`, behaviour is unchanged.
 */
export function Tabs({
  items,
  initial,
  param,
  className,
}: {
  items: TabItem[];
  initial?: string;
  param?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fallback = initial ?? items[0]?.key;
  const [localActive, setLocalActive] = useState(fallback);

  const urlActive = param ? searchParams.get(param) : null;
  // An unknown ?tab= value falls back rather than rendering nothing.
  const active =
    param
      ? (items.some((i) => i.key === urlActive) ? urlActive! : fallback)
      : localActive;
  const current = items.find((i) => i.key === active) ?? items[0];

  function select(key: string) {
    if (!param) {
      setLocalActive(key);
      return;
    }
    const next = new URLSearchParams(searchParams.toString());
    // Filters are per-tab, so drop the previous tab's filters when switching.
    for (const k of [...next.keys()]) if (k !== param) next.delete(k);
    next.set(param, key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-card/60 p-1.5">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => select(item.key)}
            aria-current={active === item.key ? "page" : undefined}
            className={cn(
              "flex-1 whitespace-nowrap rounded-xl px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
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
