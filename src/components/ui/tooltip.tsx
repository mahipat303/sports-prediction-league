"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

const WIDTH = 256;
const GAP = 10;
const MARGIN = 8;

interface Pos {
  side: "top" | "bottom";
  left: number; // viewport px (fixed)
  anchor: number; // trigger center x, viewport px
  top?: number;
  bottom?: number;
}

/**
 * Info tooltip: hover on desktop, tap to toggle on mobile. The bubble is
 * portalled to <body> and positioned against the viewport, so it is never
 * clipped by a card or overlaps neighbours — it flips above/below and clamps
 * horizontally to stay fully on screen.
 */
export function InfoTip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function place() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const anchor = r.left + r.width / 2;
    const left = Math.min(
      Math.max(anchor - WIDTH / 2, MARGIN),
      window.innerWidth - WIDTH - MARGIN
    );
    // Prefer above; flip below when there isn't room at the top.
    const side: "top" | "bottom" = r.top > 170 ? "top" : "bottom";
    setPos(
      side === "top"
        ? { side, left, anchor, bottom: window.innerHeight - r.top + GAP }
        : { side, left, anchor, top: r.bottom + GAP }
    );
  }

  function show() {
    place();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onScrollResize = () => setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
  }, [open]);

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="How is this calculated?"
        onClick={() => (open ? setOpen(false) : show())}
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
        className="text-muted-foreground/70 transition-colors hover:text-foreground"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom,
              width: WIDTH,
              zIndex: 60,
              pointerEvents: "none",
            }}
            className="rounded-xl border border-border/60 bg-popover p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-popover-foreground shadow-xl"
          >
            {children}
            {/* arrow */}
            <span
              className={cn(
                "absolute h-2 w-2 rotate-45 border-border/60 bg-popover",
                pos.side === "top" ? "border-b border-r" : "border-l border-t"
              )}
              style={{
                left: Math.min(Math.max(pos.anchor - pos.left - 4, 10), WIDTH - 18),
                [pos.side === "top" ? "bottom" : "top"]: -4,
              }}
            />
          </div>,
          document.body
        )}
    </span>
  );
}
