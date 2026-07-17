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

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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
  { label: string; multiplier: string; className: string }
> = {
  LOW: { label: "Low", multiplier: "1×", className: "text-muted-foreground" },
  MEDIUM: { label: "Medium", multiplier: "1.5×", className: "text-blue-500" },
  HIGH: { label: "High", multiplier: "2×", className: "text-purple-500" },
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
