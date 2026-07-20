/**
 * Second corrective pass for the Sports Day 2026 schedule.
 *
 * The first pass (scripts/fix-schedule.ts) deliberately skipped fixtures that
 * already carried user predictions. This script corrects those, because their
 * displayed times — and therefore their prediction lock times — were still
 * 5h30m late, and 12 of them were dated in the year 2206 so they could never
 * open for prediction at all.
 *
 * The correction is deterministic: every affected fixture was imported with
 * the same timezone bug, so a 10:00 UTC value means 10:00 IST was intended
 * (= 04:30 UTC). No Excel file is required.
 *
 * SAFETY:
 *  - COMPLETED fixtures are never touched (historical, and their startTime
 *    feeds daily streak/perfect-day bonus grouping).
 *  - Only startTime / lockTime change. Predictions, confidence, points,
 *    results, leaderboards and statistics are untouched.
 *  - Note: moving a match to its true (earlier) time can lock its predictions
 *    immediately if that time has already passed — this is intended.
 *
 * Usage:
 *   npx tsx scripts/fix-protected-times.ts            # dry run
 *   npx tsx scripts/fix-protected-times.ts --apply    # write
 */
import { prisma } from "../src/lib/prisma";
import { getSettings } from "../src/lib/scoring";

const APPLY = process.argv.includes("--apply");
const OFFSET_MS = 330 * 60_000; // IST

const fmt = (d: Date) =>
  d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

async function main() {
  console.log(APPLY ? "=== APPLYING ===" : "=== DRY RUN (no writes) ===");
  const settings = await getSettings();
  const lockMs = settings.LOCK_MINUTES_BEFORE_START * 60_000;
  const now = new Date();

  const fixtures = await prisma.fixture.findMany({
    include: { sport: true, _count: { select: { predictions: true } } },
    orderBy: { startTime: "asc" },
  });

  let fixed = 0, yearFixed = 0, willLock = 0;

  for (const f of fixtures) {
    if (f.status === "COMPLETED") continue; // historical — never touched

    const isOffset = f.startTime.getUTCHours() === 10 && f.startTime.getUTCMinutes() === 0;
    const badYear = f.startTime.getUTCFullYear() > 2100;
    if (!isOffset && !badYear) continue;

    let next = new Date(f.startTime.getTime() - (isOffset ? OFFSET_MS : 0));
    if (next.getUTCFullYear() > 2100) {
      next = new Date(next);
      next.setUTCFullYear(2026);
      yearFixed++;
    }
    if (Math.abs(next.getTime() - f.startTime.getTime()) < 60_000) continue;

    const lock = new Date(next.getTime() - lockMs);
    const locksNow = lock <= now && f._count.predictions > 0;
    if (locksNow) willLock++;

    console.log(
      `  ${f.sport.name}|${f.matchCategory}: ${f.side1Label} vs ${f.side2Label}` +
      ` [${f._count.predictions} preds]\n     ${fmt(f.startTime)}  ->  ${fmt(next)}` +
      (locksNow ? "   ⚠ locks immediately (time already passed)" : "")
    );

    if (APPLY) {
      await prisma.fixture.update({
        where: { id: f.id },
        data: { startTime: next, lockTime: lock },
      });
    }
    fixed++;
  }

  console.log(`\nSummary: ${fixed} fixtures corrected (${yearFixed} also had year 2206 fixed).`);
  console.log(`${willLock} of them lock immediately because their true time has passed.`);
  console.log(APPLY ? "Applied." : "Dry run only — re-run with --apply to write.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
