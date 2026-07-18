"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Info popover for explaining a statistic. Uses Radix Popover, which handles
 * collision-aware positioning out of the box — it flips (top/bottom) and
 * shifts to stay fully on screen, so it never overlaps neighbouring cards.
 * Opens on hover (desktop) and on tap/click (mobile); closes on outside
 * tap, Escape, or moving the pointer away.
 */
export function InfoTip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="How is this calculated?"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className={cn(
            "inline-flex text-muted-foreground/70 transition-colors hover:text-foreground focus:outline-none focus-visible:text-foreground",
            className
          )}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="center"
          sideOffset={6}
          collisionPadding={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="z-[60] w-64 max-w-[calc(100vw-16px)] rounded-xl border border-border/60 bg-popover p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-popover-foreground shadow-xl"
        >
          {children}
          <Popover.Arrow className="fill-popover" width={12} height={6} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
