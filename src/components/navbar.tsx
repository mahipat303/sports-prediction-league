"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Session } from "next-auth";
import { signOut } from "next-auth/react";
import {
  Trophy, Menu, X, LogOut, Shield, Bell, CalendarDays, CalendarClock, Users,
  UserRound, BarChart3, ListChecks, Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OpsHubIcon } from "@/components/opshub-logo";
import { resetWelcome } from "@/lib/welcome";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/avatar";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/players", label: "Players", icon: UserRound },
  { href: "/fixtures", label: "Fixtures", icon: CalendarDays },
  { href: "/schedule", label: "Schedule", icon: CalendarClock },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/predictions", label: "My Predictions", icon: ListChecks },
  { href: "/stats", label: "Stats", icon: BarChart3 },
];

export function Navbar({ session }: { session: Session | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <OpsHubIcon size={20} className="h-8 w-8 rounded-xl shadow-lg" />
          {/* Full name from xl up; shortened where the 8-link nav competes for
              space. nowrap keeps the brand on one line so the h-14 bar can
              never grow. */}
          <span className="hidden whitespace-nowrap leading-tight sm:inline xl:hidden">
            OpsHub Sports Day
          </span>
          <span className="hidden whitespace-nowrap leading-tight xl:inline">
            OpsHub Sports Day League
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                pathname === href && "bg-accent text-foreground"
              )}
            >
              {label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-amber-500 transition-colors hover:bg-accent",
                pathname.startsWith("/admin") && "bg-accent"
              )}
            >
              <Shield className="h-3.5 w-3.5" /> Admin
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {session?.user && (
            <Link href="/notifications">
              <Button variant="ghost" size="icon" aria-label="Notifications">
                <Bell className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <ThemeToggle />
          {session?.user ? (
            <div className="flex items-center gap-2 pl-1">
              <Link href="/predictions" title={session.user.name ?? ""}>
                <Avatar
                  name={session.user.name ?? "?"}
                  src={session.user.image}
                  className="h-8 w-8 text-xs"
                />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { resetWelcome(); signOut({ callbackUrl: "/" }); }}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-border/50 px-4 py-2 lg:hidden">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
                pathname === href && "bg-accent text-foreground"
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-amber-500 hover:bg-accent"
            >
              <Shield className="h-4 w-4" /> Admin
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
