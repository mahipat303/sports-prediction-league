"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

export function Countdown({ target, label }: { target: string; label?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setNow(Date.now()));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);

  if (now === null) {
    return <div className="h-16" />; // avoid hydration mismatch
  }

  const diff = new Date(target).getTime() - now;
  if (diff <= 0) {
    return null;
  }

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  const units = [
    { value: days, label: "Days" },
    { value: hours, label: "Hrs" },
    { value: minutes, label: "Min" },
    { value: seconds, label: "Sec" },
  ];

  return (
    <div>
      {label && (
        <p className="mb-2 text-sm font-medium text-muted-foreground">{label}</p>
      )}
      <div className="flex gap-2 sm:gap-3">
        {units.map((unit) => (
          <div
            key={unit.label}
            className="flex min-w-14 flex-col items-center rounded-xl border border-border/60 bg-card/60 px-3 py-2 shadow-sm backdrop-blur"
          >
            <span className="font-mono text-2xl font-bold tabular-nums sm:text-3xl">
              {pad(unit.value)}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {unit.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
