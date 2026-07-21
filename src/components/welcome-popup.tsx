"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Rocket, Sparkles, BookOpen } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { WELCOME_SEEN_KEY } from "@/lib/welcome";

/** Friendly one-per-login welcome shown to logged-in users. */
export function WelcomePopup({ name }: { name: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        if (!sessionStorage.getItem(WELCOME_SEEN_KEY)) setOpen(true);
      } catch {
        /* sessionStorage unavailable — skip */
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem(WELCOME_SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  const firstName = name.split(/\s+/)[0];

  return (
    <Modal open={open} onClose={dismiss} className="max-w-md">
      <div className="space-y-4 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-pink-500 text-white shadow-lg">
          <Rocket className="h-7 w-7" />
        </span>
        <div>
          <h2 className="text-xl font-bold">
            Welcome{firstName ? `, ${firstName}` : ""}! 🎉
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You&apos;re in the <strong>OpsHub Sports Day League</strong>.
          </p>
        </div>

        {/* ⭐ Hero petition callout */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-pink-600 p-[1.5px] shadow-lg">
          <div className="relative rounded-2xl bg-gradient-to-br from-indigo-600/95 via-violet-600/95 to-pink-600/95 p-5 text-white">
            {/* glow blobs */}
            <div className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full bg-white/20 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -right-6 h-28 w-28 rounded-full bg-pink-300/30 blur-2xl" />
            <Sparkles className="mx-auto mb-1 h-6 w-6 animate-pulse text-yellow-200" />
            <h3 className="relative text-lg font-extrabold leading-tight drop-shadow-sm sm:text-xl">
              🚀 Give OpsHub Employees Claude Access!
            </h3>
            <p className="relative mt-2 text-sm text-white/90">
              This entire app was built with the help of{" "}
              <strong className="text-white">Claude AI</strong> — the kind of
              build that would normally cost a developer many extra hours.
            </p>
            <p className="relative mt-2 text-sm font-semibold text-yellow-100">
              If you&apos;re enjoying it, consider this a friendly petition:
              maybe it&apos;s time <em>every</em> OpsHub employee got Claude. 😉✨
            </p>
          </div>
        </div>

        {/* 📖 Rules info card */}
        <div className="rounded-2xl border-2 border-amber-400/50 bg-amber-400/10 p-4 text-left shadow-sm">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-300">
            <BookOpen className="h-4 w-4" /> Read the rules before predicting
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Understanding the <strong>scoring system</strong>,{" "}
            <strong>confidence levels</strong>, <strong>penalties</strong>, and{" "}
            <strong>tournament winner</strong> predictions will help you maximise
            your points.
          </p>
          <Link href="/#rules" onClick={dismiss} className="mt-2 inline-block">
            <span className="text-xs font-semibold text-primary underline">
              📖 Open the Prediction Rules →
            </span>
          </Link>
        </div>

        <Button className="w-full" size="lg" onClick={dismiss}>
          Got it — let&apos;s predict! 🎯
        </Button>
      </div>
    </Modal>
  );
}
