"use client";

import { useEffect, useState } from "react";

/** "Locks in 2h 14m" — live countdown to a fixture's prediction lock. */
export function LockCountdown({ lockTime }: { lockTime: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setNow(Date.now()));
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);

  if (now === null) return null; // avoid hydration mismatch

  const diff = new Date(lockTime).getTime() - now;
  if (diff <= 0) return <span className="text-amber-500">🔒 Locked</span>;

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);

  const parts = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return (
    <span className={diff < 3_600_000 ? "font-medium text-amber-500" : undefined}>
      ⏳ Locks in {parts}
    </span>
  );
}
