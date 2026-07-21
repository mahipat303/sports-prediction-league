import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
}

/**
 * The office runs on IST and the server runs on UTC. Every date/time in the
 * app is therefore rendered in Asia/Kolkata explicitly — without this, the
 * same instant renders differently in a server component (runtime = UTC on
 * Vercel) than in a client component (runtime = the viewer's timezone).
 */
export const IST_TZ = "Asia/Kolkata";

/** India has no DST, so IST is a fixed +05:30 the whole year round. */
export const IST_OFFSET_MS = 330 * 60_000;

function toDate(date: Date | string): Date {
  return typeof date === "string" ? new Date(date) : date;
}

export function formatDateTime(date: Date | string): string {
  return toDate(date).toLocaleString("en-IN", {
    timeZone: IST_TZ,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** e.g. "Wed, 22 Jul 2026" — IST. */
export function formatDate(date: Date | string): string {
  return toDate(date).toLocaleDateString("en-IN", {
    timeZone: IST_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** e.g. "12:15 pm" — IST. */
export function formatTime(date: Date | string): string {
  return toDate(date).toLocaleTimeString("en-IN", {
    timeZone: IST_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "yyyy-mm-dd" in IST — used to group fixtures by match day. */
export function istDayKey(date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST_TZ }).format(
    toDate(date)
  );
}

/**
 * Format an instant as the "YYYY-MM-DDTHH:mm" string a `datetime-local` input
 * expects, expressed in IST wall-clock.
 *
 * ⚠️ Must always be paired with `parseIstInput` on the write path. These two
 * are inverses; changing one without the other shifts every saved time by
 * 5h30m.
 */
export function istInputValue(date?: Date | string | null): string {
  if (!date) return "";
  const d = toDate(date);
  if (isNaN(d.getTime())) return "";
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/**
 * Inverse of `istInputValue`: read a `datetime-local` value as IST wall-clock
 * and return the corresponding UTC instant. Returns null when unparseable.
 *
 * `new Date("2026-07-22T12:15")` must NOT be used for this — with no offset in
 * the string, JS interprets it in the *runtime's* timezone, which is UTC on
 * Vercel and the viewer's zone in the browser.
 */
export function parseIstInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const utc = Date.UTC(+y, +mo - 1, +d, +h, +mi);
  const instant = new Date(utc - IST_OFFSET_MS);
  return isNaN(instant.getTime()) ? null : instant;
}

/** Merge an IST "yyyy-mm-dd" onto an existing instant, keeping its IST time. */
export function withIstDate(current: Date, ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const ist = new Date(current.getTime() + IST_OFFSET_MS);
  return parseIstInput(`${m[1]}-${m[2]}-${m[3]}T${ist.toISOString().slice(11, 16)}`);
}

/** Merge an IST "HH:mm" onto an existing instant, keeping its IST date. */
export function withIstTime(current: Date, hm: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const day = istInputValue(current).slice(0, 10);
  return parseIstInput(`${day}T${m[1].padStart(2, "0")}:${m[2]}`);
}

export const CATEGORY_META: Record<
  string,
  { label: string; emoji: string; className: string }
> = {
  PLATINUM: {
    label: "Platinum",
    emoji: "💎",
    className:
      "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  },
  GOLD: {
    label: "Gold",
    emoji: "🥇",
    className:
      "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  SILVER: {
    label: "Silver",
    emoji: "🥈",
    className:
      "bg-slate-400/15 text-slate-600 dark:text-slate-300 border-slate-400/30",
  },
  BRONZE: {
    label: "Bronze",
    emoji: "🥉",
    className:
      "bg-orange-700/15 text-orange-700 dark:text-orange-400 border-orange-700/30",
  },
};

export const CONFIDENCE_META: Record<
  string,
  { label: string; multiplier: string; risk: string; className: string }
> = {
  LOW: { label: "Low", multiplier: "1×", risk: "no risk", className: "text-muted-foreground" },
  MEDIUM: { label: "Medium", multiplier: "1.5×", risk: "small penalty", className: "text-blue-500" },
  HIGH: { label: "High", multiplier: "2×", risk: "bigger penalty", className: "text-purple-500" },
};

export function accuracy(correct: number, wrong: number): number {
  const total = correct + wrong;
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
