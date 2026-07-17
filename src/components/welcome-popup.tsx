"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Rocket } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

const SEEN_KEY = "spl-welcome-seen";

/** Friendly one-time-per-session welcome shown to logged-in users. */
export function WelcomePopup({ name }: { name: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        if (!sessionStorage.getItem(SEEN_KEY)) setOpen(true);
      } catch {
        /* sessionStorage unavailable — skip */
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  const firstName = name.split(/\s+/)[0];

  return (
    <Modal open={open} onClose={dismiss}>
      <div className="space-y-4 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-pink-500 text-white shadow-lg">
          <Rocket className="h-7 w-7" />
        </span>
        <h2 className="text-xl font-bold">
          Welcome{firstName ? `, ${firstName}` : ""}! 🚀
        </h2>
        <p className="text-sm text-muted-foreground">
          Welcome to the <strong>Office Sports Prediction League</strong>!
        </p>
        <div className="space-y-2 rounded-xl bg-muted/50 p-4 text-left text-sm text-muted-foreground">
          <p>
            This entire application was built with the help of{" "}
            <strong className="text-foreground">Claude AI</strong>.
          </p>
          <p>
            A professional developer would typically spend many additional hours
            building and polishing an application like this from scratch.
          </p>
          <p>
            If you enjoy using this app, consider it a friendly reminder of how
            much AI can boost engineering productivity.
          </p>
          <p className="font-medium text-foreground">
            Maybe it&apos;s time every OpsHub engineer gets access to Claude. 😉
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-left text-sm">
          📖 <strong>Before your first prediction</strong>, please read the{" "}
          <Link href="/#rules" onClick={dismiss} className="text-primary underline">
            Rules section
          </Link>{" "}
          on the Home page to understand the prediction system, confidence
          levels, scoring, and penalties.
        </div>
        <Button className="w-full" onClick={dismiss}>
          Got it!
        </Button>
      </div>
    </Modal>
  );
}
