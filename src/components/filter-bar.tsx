"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  /** URL search-param key, e.g. "sport". */
  key: string;
  /** Shown as the "all" option, e.g. "All sports". */
  allLabel: string;
  options: FilterOption[];
  className?: string;
}

/**
 * Shared filter + search bar, driven entirely by URL search params.
 *
 * Filters live in the URL rather than component state so they survive refresh,
 * are shareable, and keep server components as the single source of truth —
 * the page re-renders with the new params and does the filtering itself.
 *
 * Replaces the near-identical ScheduleFilters / FixtureFilters / PlayerFilters.
 * Uses `usePathname()` so it works on any route without being told which.
 *
 * ⚠️ Not suitable for lists whose surrounding component holds unsaved client
 * state (e.g. bulk-edit selections) — navigating would discard it. Those filter
 * client-side instead.
 */
export function FilterBar({
  filters,
  search,
  /** Params to preserve when clearing, e.g. the active tab. */
  keep = [],
  className,
}: {
  filters: FilterDef[];
  search?: { key: string; placeholder: string; className?: string };
  keep?: string[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const searchParam = search ? (params.get(search.key) ?? "") : "";
  const [query, setQuery] = useState(searchParam);
  // Tracks the value we last navigated with, so the debounce doesn't re-push
  // on mount or fight an external param change (e.g. Clear, or a tab switch).
  const lastPushed = useRef(searchParam);

  useEffect(() => {
    if (!search) return;
    if (query === lastPushed.current) return;
    const id = setTimeout(() => {
      lastPushed.current = query;
      update(search.key, query);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Keep the box in sync when the param changes from outside this component.
  useEffect(() => {
    if (searchParam !== lastPushed.current) {
      lastPushed.current = searchParam;
      setQuery(searchParam);
    }
  }, [searchParam]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const keys = [...filters.map((f) => f.key), ...(search ? [search.key] : [])];
  const active = keys.some((k) => params.get(k));

  function clear() {
    const next = new URLSearchParams();
    for (const k of keep) {
      const v = params.get(k);
      if (v) next.set(k, v);
    }
    if (search) {
      lastPushed.current = "";
      setQuery("");
    }
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {search && (
        <div className={cn("relative w-full sm:w-52", search.className)}>
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="w-full pl-8"
            placeholder={search.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}
      {filters.map((f) => (
        <Select
          key={f.key}
          className={cn("w-full sm:w-40", f.className)}
          value={params.get(f.key) ?? ""}
          onChange={(e) => update(f.key, e.target.value)}
          aria-label={f.allLabel}
        >
          <option value="">{f.allLabel}</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ))}
      {active && (
        <Button variant="ghost" size="sm" onClick={clear}>
          Clear
        </Button>
      )}
    </div>
  );
}
