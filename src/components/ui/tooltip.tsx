"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dependency-free info tooltip: hover on desktop, tap to toggle on mobile
 * (closes on outside tap or Escape).
 */
export function InfoTip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label="How is this calculated?"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="text-muted-foreground/70 transition-colors hover:text-foreground"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-xl border border-border/60 bg-popover p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-popover-foreground shadow-xl"
        >
          {children}
        </span>
      )}
    </span>
  );
}
