"use client";

import { useState } from "react";
import { BookOpen, HelpCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { RulesContent, type RulesValues } from "@/components/rules";

type Variant = "floating" | "card" | "inline";

/**
 * One consistent entry point to the prediction rules, used everywhere.
 * - `floating`: fixed, glowing action button (global, every page)
 * - `card`: bright attention-grabbing banner (Fixtures page)
 * - `inline`: plain outline button
 */
export function RulesButton({
  values,
  variant = "inline",
}: {
  values: RulesValues;
  variant?: Variant;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "floating" && (
        <button
          onClick={() => setOpen(true)}
          aria-label="How the prediction league works"
          className="group fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-gradient-to-br from-indigo-600 to-pink-600 px-4 py-3 font-semibold text-white shadow-xl ring-2 ring-white/20 transition-transform hover:scale-105 sm:bottom-6 sm:right-6"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-indigo-500/40 [animation-duration:2.5s]" />
          <BookOpen className="relative h-5 w-5" />
          <span className="relative hidden text-sm sm:inline">Rules</span>
        </button>
      )}

      {variant === "card" && (
        <button
          onClick={() => setOpen(true)}
          className="group relative w-full overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-pink-500/10 p-4 text-left shadow-sm transition-all hover:scale-[1.01] hover:shadow-md"
        >
          <span className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 text-white shadow-md">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">New here? Read how predictions work 📖</p>
              <p className="text-xs text-muted-foreground">
                Scoring, confidence levels, penalties, tournament winner &amp; lock times — tap to learn.
              </p>
            </div>
            <span className="hidden flex-shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground sm:inline">
              How it works →
            </span>
          </div>
        </button>
      )}

      {variant === "inline" && (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <HelpCircle className="h-4 w-4" /> How it works
        </Button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="📖 Prediction Rules">
        <RulesContent v={values} />
        <Button className="mt-4 w-full" onClick={() => setOpen(false)}>
          Got it!
        </Button>
      </Modal>
    </>
  );
}
