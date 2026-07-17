import { getSettings } from "@/lib/scoring";
import { updateSettings } from "@/app/admin/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

const fields: { key: string; label: string; hint: string }[] = [
  { key: "POINTS_CORRECT", label: "Correct winner", hint: "Base points for a correct prediction" },
  { key: "POINTS_UPSET", label: "Correct underdog", hint: "Points when the marked underdog wins" },
  { key: "POINTS_WRONG", label: "Wrong prediction", hint: "Usually 0 — no penalty" },
  { key: "STREAK_BONUS", label: "Daily streak bonus", hint: "Per day with at least one correct call" },
  { key: "PERFECT_DAY_BONUS", label: "Perfect day bonus", hint: "All of a day's predictions correct (2+)" },
  { key: "CONFIDENCE_MEDIUM_MULT", label: "Medium confidence ×", hint: "Multiplier for medium confidence" },
  { key: "CONFIDENCE_HIGH_MULT", label: "High confidence ×", hint: "Multiplier for high confidence" },
  { key: "LOCK_MINUTES_BEFORE_START", label: "Lock minutes before start", hint: "Predictions close this many minutes before a match" },
];

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>⚙️ Scoring Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={updateSettings} className="space-y-4">
          {fields.map(({ key, label, hint }) => (
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
