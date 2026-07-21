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

      <Section icon={Flame} title="Bonuses — exactly how they're earned">
        Two bonuses are calculated per <strong>match day</strong>, on top of your
        per-match points:
        <div className="mt-2 overflow-hidden rounded-lg border border-border/60">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2">Bonus</th>
                <th className="p-2 text-right">Points</th>
                <th className="p-2">You earn it when…</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border/40">
                <td className="p-2 font-medium">🔥 Daily streak</td>
                <td className="p-2 text-right text-emerald-500">+{v.streak}</td>
                <td className="p-2">
                  You got <strong>at least 1</strong> prediction right that day
                </td>
              </tr>
              <tr className="border-t border-border/40">
                <td className="p-2 font-medium">⭐ Perfect day</td>
                <td className="p-2 text-right text-emerald-500">+{v.perfectDay}</td>
                <td className="p-2">
                  <strong>Every</strong> prediction you made that day was correct,
                  and you predicted <strong>2 or more</strong> matches
                </td>
              </tr>
              <tr className="border-t border-border/40">
                <td className="p-2 font-medium">👑 Tournament winner</td>
                <td className="p-2 text-right text-emerald-500">+{v.championBonus}</td>
                <td className="p-2">Your champion team pick was correct</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
          <li>
            <strong>When they land:</strong> daily bonuses are only calculated once
            <em> every</em> match scheduled that day has a published result — so they
            may appear a little after the last result goes in.
          </li>
          <li>
            <strong>Once per day:</strong> each bonus can be earned at most once per
            match day, no matter how many matches you predicted.
          </li>
          <li>
            <strong>A perfect day pays both:</strong> getting everything right earns
            the streak bonus <em>and</em> the perfect-day bonus —{" "}
            <strong>+{v.streak + v.perfectDay}</strong> together.
          </li>
          <li>
            <strong>Cancelled matches are ignored</strong> and never block a bonus.
          </li>
          <li>
            <strong>If a result is corrected</strong>, that day&apos;s bonuses are
            recalculated from scratch — you keep exactly what you actually earned.
          </li>
        </ul>
      </Section>

      <Section icon={Crown} title="Tournament winner prediction">
        Separately from matches, predict which team wins the whole tournament.
        A correct call earns a <strong>+{v.championBonus}</strong> bonus. This
        locks before the tournament begins and does <em>not</em> affect your
        match-prediction accuracy.
      </Section>

      <Section icon={Trophy} title="Leaderboard — how your rank is decided">
        <p>
          <strong>Total points</strong> is the sum of everything you&apos;ve earned
          and lost:
        </p>
        <p className="mt-1 rounded-lg bg-muted/50 p-2 font-mono text-[11px] leading-relaxed">
          match points − penalties + daily streak bonuses<br />
          + perfect-day bonuses + tournament winner bonus
        </p>
        <p className="mt-2">
          If two people have the same total, the tie is broken in this order —
          each step only applies if the previous one is still level:
        </p>
        <ol className="mt-1 space-y-1 text-xs">
          <li>
            <strong>1. Most total points</strong> — the primary ranking.
          </li>
          <li>
            <strong>2. More correct predictions</strong> — rewards the person who
            called more matches right, even if points ended up equal.
          </li>
          <li>
            <strong>3. Fewer wrong predictions</strong> — rewards precision. (With
            correct picks already tied, this is the same as a higher accuracy %.)
          </li>
          <li>
            <strong>4. Earliest to reach that score</strong> — whoever got to the
            total first ranks higher, like a race.
          </li>
          <li>
            <strong>5. Name (A–Z)</strong> — only if everything above is identical,
            purely so the order never changes between page refreshes.
          </li>
        </ol>
        <p className="mt-2 text-xs">
          <strong>Accuracy %</strong> = correct ÷ (correct + wrong) × 100. Matches
          you predicted that haven&apos;t been played yet are excluded, so a pending
          pick never hurts your accuracy.
        </p>
        <p className="mt-1 text-xs">
          <strong>Streak</strong> in the table is your run of consecutive{" "}
          <em>correct predictions</em> (most recent first) — one wrong pick resets it
          to 0. That&apos;s different from the daily streak bonus above, which is
          about days.
        </p>
        <p className="mt-2 text-xs">
          Top 3 are highlighted — and win prizes. 🥇🥈🥉
        </p>
      </Section>
    </div>
  );
}
