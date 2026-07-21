"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/import", label: "Excel Import" },
  { href: "/admin/fixtures", label: "Fixtures" },
  { href: "/admin/results", label: "Results" },
  { href: "/admin/insights", label: "Insights" },
  { href: "/admin/points", label: "Team Points" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 rounded-2xl border border-border/60 bg-card/60 p-1.5 backdrop-blur">
      {tabs.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "rounded-xl px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            pathname === href && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
