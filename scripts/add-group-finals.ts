/**
 * Create the missing "Group Final" fixtures.
 *
 * Some sport/category brackets send a Grand Final straight from the group
 * stage via "Winner Group A" / "Winner Group B", but their groups contain more
 * than one match — so several players win a match and nothing decides which of
 * them *wins the group*. Those Grand Finals can never resolve.
 *
 * This creates the missing decider, mirroring the Chess/Carrom template:
 *
 *   Group Final   "Winner Group A Match 1"  vs  "Winner Group A Match 2"
 *
 * Groups played as a single match are deliberately NOT touched — there is
 * nothing to decide there, and `findTarget` resolves them directly.
 *
 * DRY RUN BY DEFAULT. Pass --apply to write.
 *
 * Safety: only ever INSERTs new fixtures. Never updates or deletes an existing
 * fixture, and never touches predictions, results, points or leaderboards.
 */
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/scoring";
import { formatDateTime } from "@/lib/utils";

const APPLY = process.argv.includes("--apply");

type Planned = {
  sportId: string;
  sportName: string;
  matchCategory: string;
  group: string;
  startTime: Date;
  feeders: string[];
};

(async () => {
  const settings = await getSettings();
  const fixtures = await prisma.fixture.findMany({
    include: { sport: true },
    orderBy: { startTime: "asc" },
  });

  const norm = (s: string | null) =>
    (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const keyOf = (f: (typeof fixtures)[number]) =>
    `${f.sport.name}|${f.matchCategory}`;

  const planned: Planned[] = [];
  const skipped: string[] = [];

  for (const key of [...new Set(fixtures.map(keyOf))].sort()) {
    const rows = fixtures.filter((f) => keyOf(f) === key);

    // Already has a decider — nothing to do (idempotent).
    if (rows.some((f) => norm(f.stage) === "group final")) continue;

    // Only act where something actually references a whole group.
    const refsGroup = new Set<string>();
    for (const f of rows) {
      for (const v of [f.side1Label, f.side2Label, f.side1Source, f.side2Source]) {
        const m = /^winner\s+group\s+([A-Z])$/i.exec((v ?? "").trim());
        if (m) refsGroup.add(m[1].toUpperCase());
      }
    }
    if (refsGroup.size === 0) continue;

    for (const group of [...refsGroup].sort()) {
      const groupMatches = rows
        .filter((f) => norm(f.stage) === `group ${group.toLowerCase()} initial`)
        .sort(
          (a, b) =>
            a.startTime.getTime() - b.startTime.getTime() ||
            a.id.localeCompare(b.id)
        );

      if (groupMatches.length <= 1) {
        // Single-match group: "Winner Group X" is unambiguous and is resolved
        // in code. Creating a fixture here would invent a match with no
        // opponent.
        continue;
      }
      if (groupMatches.length !== 2) {
        skipped.push(
          `${key} Group ${group}: ${groupMatches.length} matches — "Match 1/2" labels cannot express this, needs a human decision`
        );
        continue;
      }

      planned.push({
        sportId: groupMatches[0].sportId,
        sportName: groupMatches[0].sport.name,
        matchCategory: groupMatches[0].matchCategory,
        group,
        // Same session as the group stage it concludes. Dates in this
        // tournament are provisional (matches slip), so the admin is expected
        // to reschedule — which now correctly reopens predictions.
        startTime: groupMatches[groupMatches.length - 1].startTime,
        feeders: groupMatches.map(
          (f) => `${f.side1Label} vs ${f.side2Label} [${f.status}]`
        ),
      });
    }
  }

  console.log(
    `${APPLY ? "APPLYING" : "DRY RUN"} — ${planned.length} Group Final fixture(s) to create\n`
  );
  for (const p of planned) {
    console.log(`CREATE  ${p.sportName} / ${p.matchCategory} — Group ${p.group} Final`);
    console.log(`   stage        : Group Final`);
    console.log(`   side 1       : Winner Group ${p.group} Match 1`);
    console.log(`   side 2       : Winner Group ${p.group} Match 2`);
    console.log(`   isPlaceholder: true   (blocks predictions until resolved)`);
    console.log(`   winnerPoints : 0      (only Grand Finals award Sports Day points)`);
    console.log(`   startTime    : ${formatDateTime(p.startTime)} IST  (provisional)`);
    p.feeders.forEach((f, i) => console.log(`   fed by #${i + 1}    : ${f}`));
    console.log(`   feeds        : Grand Final, via its existing "Winner Group ${p.group}" reference`);
    console.log();
  }
  if (skipped.length) {
    console.log("SKIPPED (needs a human decision):");
    skipped.forEach((s) => console.log(`   ${s}`));
    console.log();
  }

  if (!APPLY) {
    console.log("No changes written. Re-run with --apply to create these.");
    await prisma.$disconnect();
    return;
  }

  const before = {
    fixtures: await prisma.fixture.count(),
    predictions: await prisma.prediction.count(),
    completed: await prisma.fixture.count({ where: { status: "COMPLETED" } }),
    pointsHistory: await prisma.pointsHistory.count(),
  };

  for (const p of planned) {
    await prisma.fixture.create({
      data: {
        sportId: p.sportId,
        matchCategory: p.matchCategory,
        stage: "Group Final",
        side1Label: `Winner Group ${p.group} Match 1`,
        side2Label: `Winner Group ${p.group} Match 2`,
        isPlaceholder: true,
        startTime: p.startTime,
        lockTime: new Date(
          p.startTime.getTime() - settings.LOCK_MINUTES_BEFORE_START * 60_000
        ),
        winnerPoints: 0,
        runnerUpPoints: 0,
        status: "SCHEDULED",
      },
    });
  }

  const after = {
    fixtures: await prisma.fixture.count(),
    predictions: await prisma.prediction.count(),
    completed: await prisma.fixture.count({ where: { status: "COMPLETED" } }),
    pointsHistory: await prisma.pointsHistory.count(),
  };

  console.log("invariants:");
  console.log(`   fixtures      ${before.fixtures} -> ${after.fixtures}  (+${after.fixtures - before.fixtures}, expected +${planned.length}) ${after.fixtures - before.fixtures === planned.length ? "✓" : "✗"}`);
  console.log(`   predictions   ${before.predictions} -> ${after.predictions} ${before.predictions === after.predictions ? "✓ unchanged" : "✗ CHANGED"}`);
  console.log(`   completed     ${before.completed} -> ${after.completed} ${before.completed === after.completed ? "✓ unchanged" : "✗ CHANGED"}`);
  console.log(`   pointsHistory ${before.pointsHistory} -> ${after.pointsHistory} ${before.pointsHistory === after.pointsHistory ? "✓ unchanged" : "✗ CHANGED"}`);

  await prisma.$disconnect();
})();
