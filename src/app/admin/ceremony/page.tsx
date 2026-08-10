import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCeremonyAdminAwards } from "@/lib/ceremony";
import { getCeremonyConfig, SOUND_CUES } from "@/lib/ceremony-config";
import {
  saveAward, setAwardWinner, moveAward, saveCeremonySettings, addCustomAward, removeCustomAward, resetCeremonyConfig,
} from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/searchable-select";

export const dynamic = "force-dynamic";

const CUE_LABEL: Record<string, string> = {
  runnerUp: "Runner-up",
  champion: "Champion",
  teamChampion: "Team Champion",
  funny: "Funny / Special",
  luckyDraw: "Lucky Draw",
};

/** Edit the displayed champion / runner-up for one award (presentation only). */
function WinnerEditor({
  awardId, which, medal, label, current, overridden, auto, options,
}: {
  awardId: string;
  which: "champion" | "runnerUp";
  medal: string;
  label: string;
  current: string;
  overridden: boolean;
  auto: string;
  options: string[];
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 p-2">
      <div className="mb-1 flex items-center gap-2 text-xs">
        <span className="font-medium">{medal} {label}:</span>
        <span className="text-foreground">{current}</span>
        {overridden && <Badge variant="secondary" className="text-[10px]">✏️ Overridden</Badge>}
      </div>
      <form action={setAwardWinner} className="flex items-center gap-1.5">
        <input type="hidden" name="awardId" value={awardId} />
        <input type="hidden" name="which" value={which} />
        <SearchableSelect
          name="value"
          options={options.map((o) => ({ value: o, label: o }))}
          defaultValue={overridden ? current : ""}
          className="h-8 flex-1"
        />
        <Button type="submit" size="sm" variant="outline">Save</Button>
      </form>
      {overridden && (
        <form action={setAwardWinner} className="mt-1">
          <input type="hidden" name="awardId" value={awardId} />
          <input type="hidden" name="which" value={which} />
          <input type="hidden" name="value" value="" />
          <button type="submit" className="text-[11px] text-primary hover:underline">
            ↺ Reset to auto ({auto})
          </button>
        </form>
      )}
    </div>
  );
}

export default async function CeremonyAdminPage() {
  // Defence-in-depth beyond the admin layout guard.
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const [awards, config] = await Promise.all([getCeremonyAdminAwards(), getCeremonyConfig()]);
  const orderedIds = awards.map((a) => a.id).join(",");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">🎛️ Ceremony Setup</h2>
        <Link href="/ceremony" className="text-sm font-medium text-primary hover:underline">
          ▶ Open presentation
        </Link>
        <form action={resetCeremonyConfig} className="ml-auto">
          <Button type="submit" size="sm" variant="ghost">Reset all</Button>
        </form>
      </div>
      <p className="text-sm text-muted-foreground">
        Everything here is optional — presenter names, descriptions, order, custom awards,
        speeches and sounds. Unset values fall back to sensible defaults, and nothing here
        changes tournament results.
      </p>

      {/* ---- Awards: order / hide / presenter / description ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Category Awards ({awards.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {awards.map((a, i) => (
            <div key={a.id} className="rounded-xl border border-border/50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-col">
                  <form action={moveAward}>
                    <input type="hidden" name="awardId" value={a.id} />
                    <input type="hidden" name="dir" value="up" />
                    <input type="hidden" name="orderedIds" value={orderedIds} />
                    <button type="submit" disabled={i === 0} className="px-1 text-xs disabled:opacity-30" aria-label="Move up">▲</button>
                  </form>
                  <form action={moveAward}>
                    <input type="hidden" name="awardId" value={a.id} />
                    <input type="hidden" name="dir" value="down" />
                    <input type="hidden" name="orderedIds" value={orderedIds} />
                    <button type="submit" disabled={i === awards.length - 1} className="px-1 text-xs disabled:opacity-30" aria-label="Move down">▼</button>
                  </form>
                </div>
                <Badge variant="secondary">{a.sportIcon} {a.sport}</Badge>
                <span className="text-sm font-medium">{a.category}</span>
                {a.hidden && <Badge variant="warning">Hidden</Badge>}
              </div>

              {/* Winner overrides (presentation only) */}
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <WinnerEditor
                  awardId={a.id}
                  which="champion"
                  medal="🥇"
                  label="Champion"
                  current={a.champion}
                  overridden={a.championOverridden}
                  auto={a.autoChampion}
                  options={a.options}
                />
                {a.autoRunnerUp && (
                  <WinnerEditor
                    awardId={a.id}
                    which="runnerUp"
                    medal="🥈"
                    label="Runner-up"
                    current={a.runnerUp ?? "—"}
                    overridden={a.runnerUpOverridden}
                    auto={a.autoRunnerUp}
                    options={a.options}
                  />
                )}
              </div>

              <form action={saveAward} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="awardId" value={a.id} />
                <Input name="presenter" placeholder="Presenter name (optional)" defaultValue={a.presenter} className="h-8 w-52" />
                <Input name="description" placeholder="One-line description (optional)" defaultValue={a.description} className="h-8 flex-1" />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" name="hidden" defaultChecked={a.hidden} className="accent-indigo-500" /> Hide
                </label>
                <Button type="submit" size="sm" variant="outline">Save</Button>
              </form>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ---- Custom / special awards -------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Special Awards ({config.customAwards.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Add your own awards — funny categories, MVP shout-outs, anything. They appear
            after the prediction and team awards, each with a drum-roll reveal.
          </p>
          {config.customAwards.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 p-3 text-sm">
              <span className="text-xl">{c.emoji}</span>
              <span className="font-semibold">{c.title}</span>
              <span className="text-muted-foreground">→ {c.winner}{c.team ? ` (${c.team})` : ""}</span>
              {c.subtitle && <span className="text-xs text-muted-foreground">· {c.subtitle}</span>}
              <form action={removeCustomAward} className="ml-auto">
                <input type="hidden" name="id" value={c.id} />
                <Button type="submit" size="sm" variant="destructive">Remove</Button>
              </form>
            </div>
          ))}
          <form action={addCustomAward} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <Input name="emoji" placeholder="🏅" className="lg:col-span-1" />
            <Input name="title" placeholder="Award title" required className="lg:col-span-2" />
            <Input name="winner" placeholder="Winner" required className="lg:col-span-1" />
            <Input name="team" placeholder="Team (optional)" className="lg:col-span-1" />
            <Input name="subtitle" placeholder="Subtitle (optional)" className="lg:col-span-1 sm:col-span-2" />
            <div className="lg:col-span-6">
              <Button type="submit" size="sm">Add special award</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ---- Team presenters, speeches, sound ----------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Team Presenters, Speeches &amp; Sound</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveCeremonySettings} className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold">Team award presenters</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input name="team_champion" placeholder="🥇 Champion presenter" defaultValue={config.presenters["team:champion"] ?? ""} />
                <Input name="team_runnerUp" placeholder="🥈 Runner-up presenter" defaultValue={config.presenters["team:runnerUp"] ?? ""} />
                <Input name="team_third" placeholder="🥉 Third-place presenter" defaultValue={config.presenters["team:third"] ?? ""} />
              </div>
            </div>

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
                Optional: paste a hosted audio URL for any cue (e.g. a clip in <code>/public</code>,
                or any public link). When set, it plays instead of the built-in sound. Leave blank
                to use the synth.
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
