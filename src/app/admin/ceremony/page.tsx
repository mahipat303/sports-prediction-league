import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCeremonyData } from "@/lib/ceremony";
import { getCeremonyProgramForAdmin } from "@/lib/ceremony";
import { getCeremonyConfig, SOUND_CUES } from "@/lib/ceremony-config";
import { saveProgramAward, saveCeremonySettings, resetCeremonyConfig } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const CUE_LABEL: Record<string, string> = {
  runnerUp: "Runner-up",
  champion: "Winner / Champion",
  teamChampion: "Champion Team",
  funny: "Funny / Special",
  luckyDraw: "Lucky Draw",
};

const KIND_LABEL: Record<string, string> = {
  sport: "Best performers",
  athlete: "Athlete award",
  team: "Team award",
};

export default async function CeremonyAdminPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const [program, config, data] = await Promise.all([
    getCeremonyProgramForAdmin(),
    getCeremonyConfig(),
    getCeremonyData(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">🎛️ Awards Day Setup</h2>
        <Link href="/ceremony" className="text-sm font-medium text-primary hover:underline">
          ▶ Open presentation ({data.program.length} awards)
        </Link>
        <form action={resetCeremonyConfig} className="ml-auto">
          <Button type="submit" size="sm" variant="ghost">Reset to defaults</Button>
        </form>
      </div>
      <p className="text-sm text-muted-foreground">
        Edit the presenter and winner(s) for each award. Everything here is presentation-only —
        it changes what Awards Day shows and never touches tournament results.
      </p>

      {/* ---- The program ------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Program ({program.length} awards)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {program.map((a, i) => (
            <form key={a.id} action={saveProgramAward} className="rounded-xl border border-border/50 p-3">
              <input type="hidden" name="id" value={a.id} />
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{i + 1}.</span>
                <span className="text-lg">{a.emoji}</span>
                <span className="text-sm font-semibold">{a.title}</span>
                <Badge variant="secondary">{KIND_LABEL[a.kind]}</Badge>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                {a.kind === "sport" ? (
                  <>
                    <label className="text-xs text-muted-foreground">
                      Male winner
                      <Input name="male" defaultValue={a.male ?? ""} className="mt-0.5 h-8 w-44" />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Female winner
                      <Input name="female" defaultValue={a.female ?? ""} className="mt-0.5 h-8 w-44" />
                    </label>
                  </>
                ) : (
                  <label className="text-xs text-muted-foreground">
                    Winner
                    <Input name="winner" defaultValue={a.winner ?? ""} className="mt-0.5 h-8 w-56" />
                  </label>
                )}
                <label className="text-xs text-muted-foreground">
                  Presenter
                  <Input name="presenter" defaultValue={a.presenter} className="mt-0.5 h-8 w-44" />
                </label>
                <Button type="submit" size="sm" variant="outline">Save</Button>
              </div>
            </form>
          ))}
        </CardContent>
      </Card>

      {/* ---- Speeches & sound -------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Speeches &amp; Sound</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveCeremonySettings} className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-sm font-semibold">Opening line</p>
                <Input name="opening" placeholder="A welcome line (optional)" defaultValue={config.speeches.opening ?? ""} />
              </div>
              <div>
                <p className="mb-1 text-sm font-semibold">Closing line</p>
                <Input name="closing" placeholder="A sign-off line (optional)" defaultValue={config.speeches.closing ?? ""} />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">Sound</p>
              <div className="mb-3 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="sound_enabled" defaultChecked={config.sound.enabled} className="accent-indigo-500" />
                  Sound enabled by default
                </label>
                <label className="flex items-center gap-2 text-sm">
                  Default style
                  <Select name="sound_style" defaultValue={config.sound.style} className="h-8 w-32">
                    <option value="classic">🥁 Classic</option>
                    <option value="fun">🤪 Fun</option>
                  </Select>
                </label>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">
                Optional: paste a hosted audio URL for any cue (e.g. a clip in <code>/public</code>).
                When set it plays instead of the built-in sound.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SOUND_CUES.map((cue) => (
                  <label key={cue} className="flex items-center gap-2 text-xs">
                    <span className="w-28 flex-shrink-0 text-muted-foreground">{CUE_LABEL[cue]}</span>
                    <Input name={`sound_${cue}`} type="url" placeholder="https://…" defaultValue={config.sound.urls[cue] ?? ""} className="h-8" />
                  </label>
                ))}
              </div>
            </div>

            <Button type="submit">Save settings</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
