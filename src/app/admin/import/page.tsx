import { ImportForm } from "@/components/import-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminImportPage() {
  return (
    <div className="space-y-6">
      <ImportForm />

      <Card>
        <CardHeader>
          <CardTitle>📋 Supported files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Upload your two office files — the format is detected automatically.
            <strong className="text-foreground"> Import the Auction file first</strong>,
            then the Schedule file, so match participants resolve to players and teams.
          </p>
          <div>
            <p className="font-semibold text-foreground">1. Auction workbook</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>A players sheet with <code className="rounded bg-muted px-1">Name</code>, <code className="rounded bg-muted px-1">Gender</code>, <code className="rounded bg-muted px-1">Player Category</code> (Platinum/Gold/Silver, captains marked) and per-sport rating columns.</li>
              <li>A purchases sheet with four team blocks side by side (<code className="rounded bg-muted px-1">Player Purchased | Price | Purse Left</code>) grouped under category rows.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-foreground">2. Games Schedule workbook</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>An <code className="rounded bg-muted px-1">All</code> sheet (or per-sport sheets) with <code className="rounded bg-muted px-1">Sport, Category, Stage, Player/Team 1, Player/Team 2, Scheduled Date, Time, Winner Points, Runner-up Points</code>.</li>
              <li>Doubles pairs like <code className="rounded bg-muted px-1">Chintan/Purvang</code> are split and matched to players.</li>
              <li>Placeholder rounds (&quot;Winner Group A&quot;) are imported but stay closed for predictions until you resolve them under Fixtures.</li>
            </ul>
          </div>
          <p>
            Data is validated before writing. Re-importing updates schedules and
            prices without touching predictions or entered results. Sample files:
            <code className="rounded bg-muted px-1">npm run template</code> →
            <code className="rounded bg-muted px-1">excel-template/</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
