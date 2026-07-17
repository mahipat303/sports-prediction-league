"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Crown, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime } from "@/lib/utils";
import { submitChampionPrediction } from "@/app/actions";

export interface ChampionTeam {
  id: string;
  name: string;
  shortName: string;
  color: string;
  logoUrl: string | null;
  pickCount: number;
}

export function ChampionPrediction({
  teams,
  myTeamId,
  championTeamId,
  lockTime,
  bonus,
  isLoggedIn,
  totalPicks,
}: {
  teams: ChampionTeam[];
  myTeamId: string | null;
  championTeamId: string | null;
  lockTime: string | null;
  bonus: number;
  isLoggedIn: boolean;
  totalPicks: number;
}) {
  const [selected, setSelected] = useState<string | null>(myTeamId);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setNow(Date.now()));
    return () => cancelAnimationFrame(raf);
  }, []);

  const decided = Boolean(championTeamId);
  const locked =
    decided || (now != null && lockTime != null && new Date(lockTime).getTime() <= now);
  const canPick = isLoggedIn && !locked;

  function pick(teamId: string) {
    setSelected(teamId);
    const fd = new FormData();
    fd.set("teamId", teamId);
    startTransition(async () => {
      const res = await submitChampionPrediction(fd);
      if (res?.error) {
        setMessage(res.error);
        setSelected(myTeamId);
      } else {
        setMessage("Champion pick saved ✓");
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
        setTimeout(() => setMessage(null), 2500);
      }
    });
  }

  return (
    <Card className="overflow-hidden border-amber-500/30">
      <CardHeader className="bg-gradient-to-r from-amber-500/10 to-pink-500/10 pb-3">
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" /> Tournament Winner
          <Badge variant="warning" className="ml-auto">+{bonus} pts</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <p className="text-xs text-muted-foreground">
          {decided
            ? "The champion has been crowned! 👑"
            : locked
              ? "Champion predictions are locked."
              : isLoggedIn
                ? `Pick who lifts the trophy. Locks ${lockTime ? formatDateTime(lockTime) : "before the tournament"}.`
                : "Sign in to predict the overall champion."}
        </p>

        <div className="grid grid-cols-2 gap-2">
          {teams.map((team) => {
            const isMine = selected === team.id;
            const isChampion = championTeamId === team.id;
            const pct = totalPicks ? Math.round((team.pickCount / totalPicks) * 100) : 0;
            return (
              <button
                key={team.id}
                disabled={!canPick || pending}
                onClick={() => pick(team.id)}
                className={cn(
                  "relative flex flex-col gap-1.5 rounded-xl border-2 p-3 text-left transition-all",
                  isMine ? "border-transparent shadow-md" : "border-border/60 bg-background/30",
                  canPick && "cursor-pointer hover:scale-[1.02]",
                  isChampion && "ring-2 ring-amber-500"
                )}
                style={isMine ? { backgroundColor: `${team.color}1f`, borderColor: team.color } : undefined}
              >
                {isChampion && (
                  <motion.span
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 12 }}
                    className="absolute -top-3 right-1 text-xl"
                  >
                    👑
                  </motion.span>
                )}
                <div className="flex items-center gap-2">
                  <Avatar name={team.shortName} src={team.logoUrl} color={team.color} className="h-8 w-8 text-[10px]" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{team.name}</span>
                </div>
                {(totalPicks > 0 || decided) && (
                  <div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: team.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{pct}% backing</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {message && <p className="text-center text-xs font-medium text-emerald-500">{message}</p>}

        {!isLoggedIn && (
          <Link href="/login" className="block">
            <Button variant="outline" size="sm" className="w-full">Sign in to predict</Button>
          </Link>
        )}
        {locked && !decided && (
          <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> Locked
          </p>
        )}
      </CardContent>
    </Card>
  );
}
