"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Lightweight searchable combobox (no dependencies). Writes the chosen option's
 * value into a hidden input so it drops into existing forms/server actions
 * unchanged.
 *
 * By default selection is limited to the provided options. Pass `allowCustom`
 * to also let the admin type a free value that isn't in the list (offered as a
 * "Use …" entry) — used where the value can be anything (e.g. a winner name),
 * but kept opt-in so restricted pickers (placeholder resolution) are unchanged.
 */
export function SearchableSelect({
  name,
  options,
  defaultValue = "",
  placeholder = "Search…",
  className,
  allowCustom = false,
}: {
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  allowCustom?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;
  const filtered = options
    .filter(
      (o) =>
        !query ||
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.value.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 60);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm outline-none transition-colors focus:border-primary"
      >
        <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
            className="w-full border-b border-border/60 bg-transparent px-3 py-2 text-sm outline-none"
          />
          <ul className="max-h-56 overflow-y-auto py-1">
            {/* Free-text entry when the typed value isn't already an option. */}
            {allowCustom && query.trim() && !options.some((o) => o.value === query.trim()) && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setValue(query.trim());
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <Check className="h-3.5 w-3.5 shrink-0 opacity-0" />
                  <span className="truncate">
                    Use “<span className="font-medium">{query.trim()}</span>”
                  </span>
                </button>
              </li>
            )}
            {filtered.length === 0 && !(allowCustom && query.trim()) && (
              <li className="px-3 py-2 text-xs text-muted-foreground">No matches</li>
            )}
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    setValue(o.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      o.value === value ? "opacity-100 text-primary" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{o.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
