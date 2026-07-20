import { Crown, Lock, Unlock, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { setChampionWindow, setChampionVisibility } from "@/app/admin/actions";

function toLocalInput(date?: Date | null) {
  if (!date) return "";
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

/**
 * Admin controls for the Tournament Winner prediction — lock / unlock /
 * reschedule / show / hide. Independent of match fixtures.
 */
export function ChampionAdmin({
  lockTime,
  eventDate,
  championName,
  pickCount,
  bonus,
  visible,
}: {
  lockTime: Date | null;
  eventDate: Date | null;
  championName: string | null;
  pickCount: number;
  bonus: number;
  visible: boolean;
}) {
  const effective = lockTime ?? eventDate;
  const isLocked = Boolean(championName) || (effective != null && effective <= new Date());

  return (
    <Card className="border-amber-500/30">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" /> Tournament Winner Prediction
          <Badge variant={isLocked ? "warning" : "success"}>
            {isLocked ? <><Lock className="h-3 w-3" /> Locked</> : <><Unlock className="h-3 w-3" /> Open</>}
          </Badge>
          <Badge variant="secondary">{pickCount} pick{pickCount === 1 ? "" : "s"}</Badge>
          <Badge variant="outline">+{bonus} pts</Badge>
          {!visible && <Badge variant="destructive"><EyeOff className="h-3 w-3" /> Hidden</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          {championName
            ? `Champion declared: ${championName} — predictions are closed and bonuses awarded.`
            : effective
              ? `Predictions ${isLocked ? "closed" : "close"} ${formatDateTime(effective)}.`
              : "No lock time set."}
          {" "}Points are configurable in{" "}
          <a href="/admin/settings" className="text-primary hover:underline">Settings → CHAMPION_BONUS</a>.
        </p>

        {isLocked && !championName && pickCount === 0 && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-300">
            ⚠ Nobody has been able to pick a champion — the lock time has already
            passed. Unlock below to open it up.
          </p>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <form action={setChampionWindow} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="mode" value="schedule" />
            <div>
              <label className="text-xs text-muted-foreground">Predictions lock at</label>
              <Input
                name="championLockTime"
                type="datetime-local"
                defaultValue={toLocalInput(effective)}
                className="w-56"
              />
            </div>
            <Button type="submit" size="sm">Save lock time</Button>
          </form>

          <form action={setChampionWindow}>
            <input type="hidden" name="mode" value={isLocked ? "unlock" : "lock"} />
            <Button type="submit" size="sm" variant="outline" className="gap-1.5">
              {isLocked ? <><Unlock className="h-3.5 w-3.5" /> Unlock now</> : <><Lock className="h-3.5 w-3.5" /> Lock now</>}
            </Button>
          </form>

          <form action={setChampionVisibility}>
            <input type="hidden" name="visible" value={visible ? "0" : "1"} />
            <Button type="submit" size="sm" variant="outline" className="gap-1.5">
              {visible ? <><EyeOff className="h-3.5 w-3.5" /> Hide from users</> : <><Eye className="h-3.5 w-3.5" /> Show to users</>}
            </Button>
          </form>
        </div>
        <p className="text-xs text-muted-foreground">
          &quot;Unlock now&quot; opens predictions until the last scheduled match unless
          you set a specific time. These controls don&apos;t affect match predictions.
        </p>
      </CardContent>
    </Card>
  );
}
