import { getSettings } from "@/lib/scoring";
import { updateSettings } from "@/app/admin/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

const groups: { title: string; fields: { key: string; label: string; hint: string }[] }[] = [
  {
    title: "Base points",
    fields: [
      { key: "POINTS_CORRECT", label: "Correct winner", hint: "Base points for a correct prediction (before confidence ×)" },
      { key: "POINTS_UPSET", label: "Correct underdog", hint: "Base points when the marked underdog wins" },
    ],
  },
  {
    title: "Confidence — reward (× on correct) & risk (penalty on wrong)",
    fields: [
      { key: "CONFIDENCE_MEDIUM_MULT", label: "Medium confidence ×", hint: "Reward multiplier when correct (e.g. 1.5)" },
      { key: "PENALTY_MEDIUM", label: "Medium penalty", hint: "Points lost on a wrong medium-confidence pick" },
      { key: "CONFIDENCE_HIGH_MULT", label: "High confidence ×", hint: "Reward multiplier when correct (e.g. 2)" },
      { key: "PENALTY_HIGH", label: "High penalty", hint: "Points lost on a wrong high-confidence pick" },
      { key: "PENALTY_LOW", label: "Low penalty", hint: "Usually 0 — low confidence has no risk" },
    ],
  },
  {
    title: "Bonuses",
    fields: [
      { key: "STREAK_BONUS", label: "Daily streak bonus", hint: "Per day with at least one correct call" },
      { key: "PERFECT_DAY_BONUS", label: "Perfect day bonus", hint: "All of a day's predictions correct (2+)" },
      { key: "CHAMPION_BONUS", label: "Tournament winner bonus", hint: "For correctly predicting the champion team" },
    ],
  },
  {
    title: "Timing",
    fields: [
      { key: "LOCK_MINUTES_BEFORE_START", label: "Lock minutes before start", hint: "Predictions close this many minutes before a match" },
    ],
  },
];

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>⚙️ Scoring Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={updateSettings} className="space-y-6">
          {groups.map((group) => (
            <div key={group.title} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </p>
              {group.fields.map(({ key, label, hint }) => (
                <div key={key} className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </div>
                  <Input
                    name={key}
                    type="number"
                    step="any"
                    defaultValue={settings[key as keyof typeof settings]}
                    className="w-28"
                  />
                </div>
              ))}
            </div>
          ))}
          <Button type="submit">Save settings</Button>
          <p className="text-xs text-muted-foreground">
            Changes apply to results entered after saving. Lock time changes
            apply to newly created fixtures.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
