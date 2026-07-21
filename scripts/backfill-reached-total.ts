/**
 * One-off backfill for the leaderboard "earliest to reach the total"
 * tie-break. Seeds `LeaderboardEntry.reachedTotalAt` for existing entries
 * using each user's most recent PointsHistory row (the moment they arrived at
 * their current total), falling back to the entry's updatedAt.
 *
 * Only fills rows where the column is still null — safe to re-run.
 * Reads/writes nothing else: predictions, points and results are untouched.
 *
 * Usage:
 *   npx tsx scripts/backfill-reached-total.ts            # dry run
 *   npx tsx scripts/backfill-reached-total.ts --apply    # write
 */
import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(APPLY ? "=== APPLYING ===" : "=== DRY RUN (no writes) ===");

  const entries = await prisma.leaderboardEntry.findMany({
    include: { user: { select: { name: true } } },
  });
  let filled = 0;

  for (const e of entries) {
    if (e.reachedTotalAt) continue;
    const last = await prisma.pointsHistory.findFirst({
      where: { userId: e.userId },
      orderBy: { createdAt: "desc" },
    });
    const stamp = last?.createdAt ?? e.updatedAt;
    console.log(
      `  ${e.user.name.padEnd(24)} ${String(e.totalPoints).padStart(5)} pts -> ${stamp.toISOString()}`
    );
    if (APPLY) {
      await prisma.leaderboardEntry.update({
        where: { id: e.id },
        data: { reachedTotalAt: stamp },
      });
    }
    filled++;
  }

  console.log(`\n${filled} entr${filled === 1 ? "y" : "ies"} backfilled (${entries.length} total).`);
  console.log(APPLY ? "Applied." : "Dry run only — re-run with --apply to write.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
