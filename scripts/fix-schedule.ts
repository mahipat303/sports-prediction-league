/**
 * One-off corrective migration for the Sports Day 2026 schedule.
 *
 *  1. Corrects match times that were stored +5:30 off (imported from a UTC host
 *     before the timezone fix in excel-import.ts).
 *  2. Fixes fixtures whose year was typo'd as 2206 in the sheet.
 *  3. Creates the Grand Final fixtures that the sheet lists with blank
 *     participants (so they never imported), as placeholders to resolve.
 *
 * SAFETY: only touches fixtures that are SCHEDULED **and have zero
 * predictions**. Completed fixtures, fixtures carrying predictions, results,
 * points, and leaderboards are never modified.
 *
 * Usage:
 *   npx tsx scripts/fix-schedule.ts "<schedule.xlsx>"           # dry run
 *   npx tsx scripts/fix-schedule.ts "<schedule.xlsx>" --apply   # write
 */
import * as XLSX from "xlsx";
import { prisma } from "../src/lib/prisma";
import { getSettings } from "../src/lib/scoring";

const IST = 330 * 60_000;
const APPLY = process.argv.includes("--apply");
const FILE = process.argv[2];

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const fmt = (d: Date) =>
  d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

/** Build the instant for an IST wall-clock date/time (server-TZ independent). */
function istInstant(y: number, mo: number, d: number, h: number, mi: number) {
  return new Date(Date.UTC(y, mo, d, h, mi) - IST);
}

function parseRow(dateCell: unknown, timeCell: unknown) {
  let y: number, mo: number, d: number;
  if (dateCell instanceof Date) { y = dateCell.getFullYear(); mo = dateCell.getMonth(); d = dateCell.getDate(); }
  else if (typeof dateCell === "number") {
    const p = XLSX.SSF.parse_date_code(dateCell);
    if (!p) return null;
    y = p.y; mo = p.m - 1; d = p.d;
  } else if (typeof dateCell === "string" && dateCell.trim()) {
    const dt = new Date(dateCell.trim().replace(/^[A-Za-z]{3,9},\s*/, ""));
    if (isNaN(dt.getTime())) return null;
    y = dt.getFullYear(); mo = dt.getMonth(); d = dt.getDate();
  } else return null;

  let h = 10, mi = 0;
  if (typeof timeCell === "number" && timeCell > 0 && timeCell < 1) {
    const t = Math.round(timeCell * 24 * 60); h = Math.floor(t / 60); mi = t % 60;
  } else if (timeCell instanceof Date) { h = timeCell.getHours(); mi = timeCell.getMinutes(); }

  // Repair the typo'd 2206 year seen in the sheet.
  if (y > 2100) y = 2026;
  return istInstant(y, mo, d, h, mi);
}

async function main() {
  if (!FILE) { console.error("Usage: tsx scripts/fix-schedule.ts <file.xlsx> [--apply]"); process.exit(1); }
  console.log(APPLY ? "=== APPLYING CHANGES ===" : "=== DRY RUN (no writes) ===");

  const wb = XLSX.readFile(FILE);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["All"], { defval: null });
  const settings = await getSettings();
  const lockMs = settings.LOCK_MINUTES_BEFORE_START * 60_000;

  const fixtures = await prisma.fixture.findMany({
    include: { sport: true, _count: { select: { predictions: true } } },
  });
  const safe = (f: (typeof fixtures)[number]) => f.status === "SCHEDULED" && f._count.predictions === 0;
  const keyOf = (sport: string, cat: string, stage: string, a: string, b: string) =>
    `${sport}|${cat}|${stage}|${a}|${b}`.toLowerCase();
  const byKey = new Map(fixtures.map((f) => [keyOf(f.sport.name, f.matchCategory, f.stage ?? "", f.side1Label, f.side2Label), f]));

  // ---- 1 & 2: correct times / years on safe fixtures ----
  let timeFixed = 0, skippedProtected = 0;
  for (const r of rows) {
    const sport = s(r["Sport"]), a = s(r["Player/Team 1"]), b = s(r["Player/Team 2"]);
    if (!sport || !a || !b) continue;
    const f = byKey.get(keyOf(sport, s(r["Category"]), s(r["Stage"]), a, b));
    if (!f) continue;
    const want = parseRow(r["Scheduled Date"], r["Time"]);
    if (!want || Math.abs(f.startTime.getTime() - want.getTime()) < 60_000) continue;
    if (!safe(f)) {
      skippedProtected++;
      console.log(`  SKIP (protected: ${f.status}, ${f._count.predictions} preds) ${sport} ${a} vs ${b}: ${fmt(f.startTime)} -> would be ${fmt(want)}`);
      continue;
    }
    console.log(`  TIME ${sport}|${f.matchCategory} ${a} vs ${b}: ${fmt(f.startTime)} -> ${fmt(want)}`);
    if (APPLY) {
      await prisma.fixture.update({
        where: { id: f.id },
        data: { startTime: want, lockTime: new Date(want.getTime() - lockMs) },
      });
    }
    timeFixed++;
  }

  // ---- 3: create missing Grand Finals (blank participants in the sheet) ----
  let created = 0;
  for (const r of rows) {
    const sport = s(r["Sport"]), cat = s(r["Category"]), stage = s(r["Stage"]);
    if (!sport || !cat || s(r["Player/Team 1"]) || s(r["Player/Team 2"])) continue;
    if (!/final/i.test(stage)) continue;

    const sportRow = await prisma.sport.findUnique({ where: { name: sport } });
    if (!sportRow) { console.log(`  WARN unknown sport "${sport}" — skipped`); continue; }

    const siblings = fixtures.filter((f) => f.sport.name === sport && f.matchCategory === cat);
    if (siblings.some((f) => f.stage === stage)) continue; // already exists
    // Team sports keep their semis under a different category ("Semi final"),
    // so fall back to the whole sport when the category has no earlier rounds.
    const pool = siblings.length ? siblings : fixtures.filter((f) => f.sport.name === sport);
    const hasSemis = pool.some((f) => /semi/i.test(f.stage ?? ""));
    const [l1, l2] = hasSemis
      ? ["Winner Semi Final 1", "Winner Semi Final 2"]
      : ["Winner Group A", "Winner Group B"];

    const start = parseRow(r["Scheduled Date"], r["Time"]);
    if (!start) { console.log(`  WARN no date for ${sport}|${cat} final — skipped`); continue; }

    console.log(`  CREATE ${sport}|${cat}|${stage}: ${l1} vs ${l2} @ ${fmt(start)} [WP=${r["Winner Points"]} RP=${r["Runner-up Points"]}]`);
    if (APPLY) {
      await prisma.fixture.create({
        data: {
          sportId: sportRow.id, matchCategory: cat, stage,
          side1Label: l1, side2Label: l2, isPlaceholder: true,
          startTime: start, lockTime: new Date(start.getTime() - lockMs),
          winnerPoints: typeof r["Winner Points"] === "number" ? (r["Winner Points"] as number) : 0,
          runnerUpPoints: typeof r["Runner-up Points"] === "number" ? (r["Runner-up Points"] as number) : 0,
        },
      });
    }
    created++;
  }

  console.log(`\nSummary: ${timeFixed} times corrected, ${created} finals created, ${skippedProtected} protected fixtures left untouched.`);
  console.log(APPLY ? "Applied." : "Dry run only — re-run with --apply to write.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
