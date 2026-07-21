import { CheckCircle2, Clock, Zap, Crown, Flame, Trophy } from "lucide-react";

export interface RulesValues {
  pointsCorrect: number;
  pointsUpset: number;
  medMult: number;
  highMult: number;
  penMed: number;
  penHigh: number;
  streak: number;
  perfectDay: number;
  championBonus: number;
  lockMinutes: number;
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h3>
      <div className="pl-6 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

/** Presentational rules explainer. Values come from live scoring settings. */
export function RulesContent({ v }: { v: RulesValues }) {
  return (
    <div className="space-y-4">
      <Section icon={CheckCircle2} title="How predictions work">
        Pick the winner for any upcoming match. You can change your pick freely
        until predictions lock. One prediction per match.
      </Section>

      <Section icon={Clock} title="When predictions lock">
        Predictions close automatically{" "}
        <strong>{v.lockMinutes} minutes before</strong> a match starts. Once
        locked, a pick can&apos;t be changed. Knockout matches with undecided
        participants (&quot;Winner Group A&quot;) open once the admin fills in the players.
      </Section>

      <Section icon={Zap} title="Confidence — reward vs. risk">
        Set a confidence level on each pick. Higher confidence means a bigger
        reward if you&apos;re right, but a penalty if you&apos;re wrong:
        <div className="mt-2 overflow-hidden rounded-lg border border-border/60">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2">Confidence</th>
                <th className="p-2 text-right">If correct</th>
                <th className="p-2 text-right">If wrong</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border/40">
                <td className="p-2">Low (1×)</td>
                <td className="p-2 text-right text-emerald-500">+{v.pointsCorrect}</td>
                <td className="p-2 text-right">0</td>
              </tr>
              <tr className="border-t border-border/40">
                <td className="p-2">Medium ({v.medMult}×)</td>
                <td className="p-2 text-right text-emerald-500">+{Math.round(v.pointsCorrect * v.medMult)}</td>
                <td className="p-2 text-right text-red-500">−{v.penMed}</td>
              </tr>
              <tr className="border-t border-border/40">
                <td className="p-2">High ({v.highMult}×)</td>
                <td className="p-2 text-right text-emerald-500">+{Math.round(v.pointsCorrect * v.highMult)}</td>
                <td className="p-2 text-right text-red-500">−{v.penHigh}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs">
          Underdog wins are worth more — a correct pick on a marked upset uses a
          base of {v.pointsUpset} instead of {v.pointsCorrect}.
        </p>
      </Section>

      <Section icon={Flame} title="Bonuses">
        <ul className="list-inside list-disc space-y-0.5">
          <li>Daily streak: <strong>+{v.streak}</strong> for each day you get at least one pick right.</li>
          <li>Perfect day: <strong>+{v.perfectDay}</strong> when all your picks for a day are correct (2+ matches).</li>
        </ul>
      </Section>

      <Section icon={Crown} title="Tournament winner prediction">
        Separately from matches, predict which team wins the whole tournament.
        A correct call earns a <strong>+{v.championBonus}</strong> bonus. This
        locks before the tournament begins and does <em>not</em> affect your
        match-prediction accuracy.
      </Section>

      <Section icon={Trophy} title="Leaderboard & tie-breaks">
        Your total points (match picks + all bonuses) rank you on the
        leaderboard. Ties are broken in this order:
        <ol className="mt-1 list-inside list-decimal space-y-0.5">
          <li>Most <strong>total points</strong></li>
          <li>More <strong>correct predictions</strong></li>
          <li>Fewer <strong>wrong predictions</strong></li>
          <li><strong>Earliest to reach</strong> that score</li>
        </ol>
        Top 3 are highlighted — and win prizes. 🥇🥈🥉
      </Section>
    </div>
  );
}
