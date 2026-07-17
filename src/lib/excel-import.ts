import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { PlayerCategory, Prisma } from "@prisma/client";
import { getSettings } from "@/lib/scoring";

/**
 * Imports the office's real Excel formats, auto-detected per workbook:
 *
 * 1. AUCTION workbook ("Sports Day - Auction.xlsx")
 *    - A players sheet: Slide No | Name | Gender | Player Category | ... |
 *      per-sport self-rating columns (Table Tennis, Badminton, Chess, ...)
 *    - A purchases sheet: four team blocks laid out side by side. Row 0 has
 *      the team (owner-pair) names, row 1 repeats "Player Purchased | Price |
 *      Purse Left | Sports Covered". Rows are grouped under category header
 *      rows (Platinum / Gold / Silver).
 *
 * 2. SCHEDULE workbook ("Games Schedule_Sports.xlsx")
 *    - Sheet "All" (or per-sport sheets): Sport | Category | Stage |
 *      Player/Team 1 | Player/Team 2 | Scheduled Date | Time | Winner |
 *      Runner-up | Winner Points | Runner-up Points
 *    - Sides are single players ("Parth"), doubles pairs ("Chintan/Purvang"),
 *      or placeholders ("Winner Group A") for knockout rounds.
 */

export interface ImportResult {
  ok: boolean;
  detected: "auction" | "schedule" | "unknown";
  errors: string[];
  warnings: string[];
  counts: Record<string, number>;
}

type Cell = string | number | boolean | Date | null;
type Row = Cell[];

const TEAM_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#10b981", "#ec4899"];

const SPORT_ICONS: Record<string, string> = {
  chess: "♟️",
  carrom: "🎯",
  "table tennis": "🏓",
  badminton: "🏸",
  volleyball: "🏐",
  vollyball: "🏐",
  "box-cricket": "🏏",
  "box cricket": "🏏",
  cricket: "🏏",
  pickleball: "🎾",
};

function s(value: Cell): string {
  return value == null ? "" : String(value).trim();
}

function normalizeCategory(value: string): PlayerCategory | null {
  const v = value.toUpperCase().replace(/[^A-Z]/g, "");
  if (v.startsWith("PLATINUM")) return "PLATINUM";
  if (v.startsWith("GOLD")) return "GOLD";
  if (v.startsWith("SILVER")) return "SILVER";
  if (v.startsWith("BRONZE")) return "BRONZE";
  return null;
}

/** Parse "Mon, Jul 20, 2026", plain date strings, Excel serials, or Date cells. */
function parseScheduleDate(dateCell: Cell, timeCell: Cell): Date | null {
  let base: Date | null = null;
  if (dateCell instanceof Date) {
    base = new Date(dateCell);
  } else if (typeof dateCell === "number") {
    const parsed = XLSX.SSF.parse_date_code(dateCell);
    if (parsed) base = new Date(parsed.y, parsed.m - 1, parsed.d);
  } else if (typeof dateCell === "string" && dateCell.trim()) {
    // Strip a leading day-of-week ("Mon, Jul 20, 2026" → "Jul 20, 2026")
    const cleaned = dateCell.trim().replace(/^[A-Za-z]{3,9},\s*/, "");
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) base = d;
  }
  if (!base || isNaN(base.getTime())) return null;

  let hours = 10, minutes = 0; // default match time when unspecified
  if (typeof timeCell === "number" && timeCell > 0 && timeCell < 1) {
    const totalMinutes = Math.round(timeCell * 24 * 60);
    hours = Math.floor(totalMinutes / 60);
    minutes = totalMinutes % 60;
  } else if (timeCell instanceof Date) {
    hours = timeCell.getHours();
    minutes = timeCell.getMinutes();
  } else if (typeof timeCell === "string" && timeCell.trim()) {
    const match = timeCell.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
    if (match) {
      hours = Number(match[1]) % 12;
      if (match[3]?.toLowerCase() === "pm") hours += 12;
      if (!match[3] && Number(match[1]) > 12) hours = Number(match[1]);
      minutes = Number(match[2]);
    }
  }
  base.setHours(hours, minutes, 0, 0);
  return base;
}

/**
 * Resolve a short name from the auction/schedule sheets ("Parth", "PP",
 * "Prashant Patel") to a known player. Tries, in order: exact full name,
 * unique first-name match, unique full-name prefix, unique initials match.
 */
function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

function matchPlayer<T extends { id: string; name: string }>(
  label: string,
  players: T[],
  taken?: Set<string>
): T | null {
  const needle = label.toLowerCase().trim();
  if (!needle) return null;

  // When a tier is ambiguous, players already claimed in this import run
  // (e.g. "Gaurav Khungar" bought elsewhere) are excluded before giving up.
  const pick = (candidates: T[]): T | null => {
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1 && taken) {
      const free = candidates.filter((c) => !taken.has(c.id));
      if (free.length === 1) return free[0];
    }
    return null;
  };

  const exact = pick(players.filter((p) => p.name.toLowerCase().trim() === needle));
  if (exact) return exact;

  const firstName = (p: T) => p.name.toLowerCase().split(/\s+/)[0];

  const byFirst = pick(players.filter((p) => firstName(p) === needle));
  if (byFirst) return byFirst;

  const byPrefix = pick(players.filter((p) => p.name.toLowerCase().startsWith(needle)));
  if (byPrefix) return byPrefix;

  if (/^[a-z]{2,4}$/i.test(needle)) {
    const byInitials = pick(
      players.filter(
        (p) => p.name.toLowerCase().split(/\s+/).map((w) => w[0]).join("") === needle
      )
    );
    if (byInitials) return byInitials;
  }

  // "Punit A" → unique first-token match ("Punit Vachhani")
  const firstToken = needle.split(/\s+/)[0];
  if (firstToken.length >= 3) {
    const byToken = pick(players.filter((p) => firstName(p) === firstToken));
    if (byToken) return byToken;
  }

  // Spelling variants: "Chinmai" → "Chinmayi" (edit distance ≤ 1)
  if (needle.length >= 4) {
    const byFuzzy = pick(
      players.filter((p) => editDistance(firstName(p), firstToken) <= 1)
    );
    if (byFuzzy) return byFuzzy;
  }
  return null;
}

function isPlaceholderLabel(label: string): boolean {
  return /^(winner|loser|runner|tbd|qualifier)\b/i.test(label.trim());
}

function sheetRows(workbook: XLSX.WorkBook, name: string): Row[] {
  return XLSX.utils.sheet_to_json<Row>(workbook.Sheets[name], {
    header: 1,
    defval: null,
  });
}

// ---------------------------------------------------------------------------
// Auction workbook
// ---------------------------------------------------------------------------

async function importAuction(
  workbook: XLSX.WorkBook,
  result: ImportResult
): Promise<void> {
  // --- Locate sheets by their header signatures ---
  let playersSheet: Row[] | null = null;
  let purchasesSheet: Row[] | null = null;

  for (const name of workbook.SheetNames) {
    const rows = sheetRows(workbook, name);
    if (rows.length < 2) continue;
    const flat = rows
      .slice(0, 3)
      .flat()
      .map((c) => s(c).toLowerCase());
    if (flat.includes("player category") && !playersSheet) playersSheet = rows;
    if (flat.includes("player purchased") && !purchasesSheet) purchasesSheet = rows;
  }

  // --- Players sheet ---
  if (playersSheet) {
    const header = playersSheet[0].map((c) => s(c));
    const col = (label: string) =>
      header.findIndex((h) => h.toLowerCase() === label.toLowerCase());
    const nameCol = col("Name");
    const genderCol = col("Gender");
    const categoryCol = col("Player Category");
    if (nameCol === -1 || categoryCol === -1) {
      result.errors.push(
        "Players sheet found, but 'Name' / 'Player Category' columns are missing."
      );
      return;
    }
    // Sport rating columns: numeric-valued columns beyond the known meta columns
    const metaCols = new Set([nameCol, genderCol, categoryCol, col("Slide No")]);
    const ratingCols = header
      .map((h, i) => ({ h, i }))
      .filter(
        ({ h, i }) =>
          !metaCols.has(i) &&
          h &&
          !/platinum|available|participate/i.test(h) &&
          playersSheet!.slice(1, 15).some((r) => typeof r[i] === "number")
      );

    let imported = 0;
    for (const [idx, row] of playersSheet.slice(1).entries()) {
      const name = s(row[nameCol]);
      if (!name) continue;
      const rawCategory = s(row[categoryCol]);
      const category = normalizeCategory(rawCategory);
      if (!category) {
        result.warnings.push(
          `Players row ${idx + 2}: unknown category "${rawCategory}" for ${name}, defaulting to Silver`
        );
      }
      const ratings: Record<string, number> = {};
      for (const { h, i } of ratingCols) {
        if (typeof row[i] === "number") ratings[h] = row[i] as number;
      }
      await prisma.player.upsert({
        where: { name },
        create: {
          name,
          gender: genderCol !== -1 ? s(row[genderCol]) || null : null,
          category: category ?? "SILVER",
          isCaptain: /captain/i.test(rawCategory),
          ratings: Object.keys(ratings).length ? JSON.stringify(ratings) : null,
        },
        update: {
          gender: genderCol !== -1 ? s(row[genderCol]) || null : undefined,
          category: category ?? undefined,
          isCaptain: /captain/i.test(rawCategory),
          ratings: Object.keys(ratings).length ? JSON.stringify(ratings) : undefined,
        },
      });
      imported++;
    }
    result.counts.players = imported;
  }

  // --- Purchases sheet (team blocks side by side) ---
  if (purchasesSheet) {
    const teamNameRow = purchasesSheet[0];
    const headerRow = purchasesSheet[1].map((c) => s(c).toLowerCase());
    const blocks: { col: number; teamName: string }[] = [];
    headerRow.forEach((h, i) => {
      if (h === "player purchased") {
        const teamName = s(teamNameRow[i]);
        if (teamName) blocks.push({ col: i, teamName });
      }
    });
    if (blocks.length === 0) {
      result.errors.push(
        "Purchases sheet found, but no 'Player Purchased' team blocks detected."
      );
      return;
    }

    const allPlayers = await prisma.player.findMany();
    let teamsImported = 0;
    let purchases = 0;
    // Two passes: exact/unambiguous matches claim their players first, so the
    // fuzzy tiers can disambiguate short names like "Gaurav" on pass two.
    const takenPlayerIds = new Set<string>();
    for (const nameRow of purchasesSheet.slice(2)) {
      for (const block of blocks) {
        const cell = s(nameRow[block.col]);
        if (!cell || normalizeCategory(cell)) continue;
        const exact = allPlayers.find(
          (p) => p.name.toLowerCase().trim() === cell.toLowerCase()
        );
        if (exact) takenPlayerIds.add(exact.id);
      }
    }

    const usedShortNames = new Set(
      (await prisma.team.findMany()).map((t) => `${t.name}\0${t.shortName}`)
    );

    for (const [blockIdx, block] of blocks.entries()) {
      // Initials of each owner ("Aakash & Bhoomi" → "A&B"); widen on collision
      const owners = block.teamName.split(/\s*&\s*/).map((p) => p.trim());
      let shortName = "";
      for (let len = 1; len <= 3; len++) {
        shortName = owners
          .map((o) => o.slice(0, len))
          .join("&")
          .toUpperCase();
        const takenByOther = [...usedShortNames].some((key) => {
          const [name, sn] = key.split("\0");
          return sn === shortName && name !== block.teamName;
        });
        if (!takenByOther) break;
      }
      usedShortNames.add(`${block.teamName}\0${shortName}`);

      // Walk the block's rows: category headers ("Platinum") switch context;
      // rows with a name + numeric price are purchases.
      let currentCategory: PlayerCategory = "PLATINUM";
      const bought: { name: string; price: number; category: PlayerCategory }[] = [];
      let lastPurseLeft = 0;

      for (const row of purchasesSheet.slice(2)) {
        const nameCell = s(row[block.col]);
        const price = row[block.col + 1];
        const purseLeft = row[block.col + 2];
        const asCategory = nameCell ? normalizeCategory(nameCell) : null;
        if (asCategory && typeof price !== "number") {
          currentCategory = asCategory;
          continue;
        }
        if (typeof purseLeft === "number") lastPurseLeft = purseLeft;
        if (nameCell && typeof price === "number") {
          bought.push({ name: nameCell, price, category: currentCategory });
        }
      }

      // The sheet's own arithmetic: everything spent plus whatever purse the
      // team still shows at the bottom of its block.
      const spent = bought.reduce((sum, b) => sum + b.price, 0);
      const totalBudget = spent + lastPurseLeft;

      const team = await prisma.team.upsert({
        where: { name: block.teamName },
        create: {
          name: block.teamName,
          shortName: shortName || `T${blockIdx + 1}`,
          ownerName: block.teamName,
          color: TEAM_COLORS[blockIdx % TEAM_COLORS.length],
          totalBudget,
          remainingBudget: Math.max(0, totalBudget - spent),
        },
        update: {
          totalBudget: totalBudget || undefined,
          remainingBudget: totalBudget ? Math.max(0, totalBudget - spent) : undefined,
        },
      });
      teamsImported++;

      for (const buy of bought) {
        const player = matchPlayer(buy.name, allPlayers, takenPlayerIds);
        if (!player) {
          result.warnings.push(
            `Team "${block.teamName}": could not match purchased player "${buy.name}" to the players list`
          );
          continue;
        }
        takenPlayerIds.add(player.id);
        await prisma.player.update({
          where: { id: player.id },
          data: {
            teamId: team.id,
            auctionPrice: buy.price,
            category: buy.category,
          },
        });
        const existingEvent = await prisma.auctionEvent.findFirst({
          where: { playerId: player.id },
        });
        if (existingEvent) {
          await prisma.auctionEvent.update({
            where: { id: existingEvent.id },
            data: { teamId: team.id, price: buy.price },
          });
        } else {
          await prisma.auctionEvent.create({
            data: { playerId: player.id, teamId: team.id, price: buy.price },
          });
        }
        purchases++;
      }
    }
    result.counts.teams = teamsImported;
    result.counts.purchases = purchases;
  }

  if (!playersSheet && !purchasesSheet) {
    result.errors.push("No players or purchases sheets recognized in the auction workbook.");
  }
}

// ---------------------------------------------------------------------------
// Schedule workbook
// ---------------------------------------------------------------------------

const SCHEDULE_HEADERS = ["sport", "category", "stage", "player/team 1", "player/team 2"];

function isScheduleSheet(rows: Row[]): boolean {
  if (rows.length < 2) return false;
  const header = rows[0].map((c) => s(c).toLowerCase());
  return SCHEDULE_HEADERS.every((h) => header.includes(h));
}

async function importSchedule(
  workbook: XLSX.WorkBook,
  result: ImportResult
): Promise<void> {
  // Prefer the "All" sheet; otherwise merge all schedule-shaped sheets.
  const rows: Row[] = [];
  let header: string[] = [];
  const allSheet = workbook.SheetNames.find((n) => n.toLowerCase().trim() === "all");
  const sources = allSheet ? [allSheet] : workbook.SheetNames;
  for (const name of sources) {
    const sheet = sheetRows(workbook, name);
    if (!isScheduleSheet(sheet)) continue;
    if (header.length === 0) header = sheet[0].map((c) => s(c));
    rows.push(...sheet.slice(1));
  }
  if (header.length === 0) {
    result.errors.push("No schedule sheet recognized (expected columns: Sport, Category, Stage, Player/Team 1, Player/Team 2, Scheduled Date).");
    return;
  }

  const col = (label: string) =>
    header.findIndex((h) => h.toLowerCase() === label.toLowerCase());
  const cols = {
    sport: col("Sport"),
    category: col("Category"),
    stage: col("Stage"),
    side1: col("Player/Team 1"),
    side2: col("Player/Team 2"),
    date: col("Scheduled Date"),
    time: col("Time"),
    winner: col("Winner"),
    winnerPoints: col("Winner Points"),
    runnerUpPoints: col("Runner-up Points"),
  };

  const settings = await getSettings();
  const allPlayers = await prisma.player.findMany();
  const sportCache = new Map<string, string>(); // name → id
  let created = 0;
  let updated = 0;

  for (const [idx, row] of rows.entries()) {
    const rowNo = idx + 2;
    const sportName = s(row[cols.sport]);
    const side1Label = s(row[cols.side1]);
    const side2Label = s(row[cols.side2]);
    if (!sportName || !side1Label || !side2Label) continue;

    const startTime = parseScheduleDate(row[cols.date], cols.time !== -1 ? row[cols.time] : null);
    if (!startTime) {
      result.errors.push(`Schedule row ${rowNo}: missing or invalid Scheduled Date`);
      continue;
    }

    let sportId = sportCache.get(sportName.toLowerCase());
    if (!sportId) {
      const sport = await prisma.sport.upsert({
        where: { name: sportName },
        create: { name: sportName, icon: SPORT_ICONS[sportName.toLowerCase()] ?? "🏅" },
        update: {},
      });
      sportId = sport.id;
      sportCache.set(sportName.toLowerCase(), sportId);
    }

    const matchCategory = s(row[cols.category]) || "Open";
    const stage = s(row[cols.stage]) || null;
    const isPlaceholder =
      isPlaceholderLabel(side1Label) || isPlaceholderLabel(side2Label);

    // Resolve side players and owning teams
    const sides: { players: { id: string; teamId: string | null }[]; teamId: string | null }[] = [];
    for (const label of [side1Label, side2Label]) {
      const players: { id: string; teamId: string | null }[] = [];
      if (!isPlaceholderLabel(label)) {
        for (const part of label.split("/").map((p) => p.trim()).filter(Boolean)) {
          const player = matchPlayer(part, allPlayers);
          if (player) players.push({ id: player.id, teamId: player.teamId });
          else
            result.warnings.push(
              `Schedule row ${rowNo}: could not match "${part}" to a player (side kept as label)`
            );
        }
      }
      const teamIds = [...new Set(players.map((p) => p.teamId).filter(Boolean))];
      sides.push({ players, teamId: teamIds.length === 1 ? (teamIds[0] as string) : null });
    }

    // Winner column (some rows may already have results)
    let winnerSide: number | null = null;
    const winnerLabel = cols.winner !== -1 ? s(row[cols.winner]) : "";
    if (winnerLabel) {
      if (winnerLabel.toLowerCase() === side1Label.toLowerCase()) winnerSide = 1;
      else if (winnerLabel.toLowerCase() === side2Label.toLowerCase()) winnerSide = 2;
      else
        result.warnings.push(
          `Schedule row ${rowNo}: winner "${winnerLabel}" doesn't match either side — result not imported`
        );
    }

    const data: Prisma.FixtureUncheckedCreateInput = {
      sportId,
      matchCategory,
      stage,
      side1Label,
      side2Label,
      side1TeamId: sides[0].teamId,
      side2TeamId: sides[1].teamId,
      isPlaceholder,
      startTime,
      lockTime: new Date(startTime.getTime() - settings.LOCK_MINUTES_BEFORE_START * 60_000),
      winnerPoints: typeof row[cols.winnerPoints] === "number" ? (row[cols.winnerPoints] as number) : 0,
      runnerUpPoints: typeof row[cols.runnerUpPoints] === "number" ? (row[cols.runnerUpPoints] as number) : 0,
      winnerSide,
      status: winnerSide ? "COMPLETED" : "SCHEDULED",
    };

    const existing = await prisma.fixture.findFirst({
      where: { sportId, matchCategory, stage, side1Label, side2Label },
    });
    let fixtureId: string;
    if (existing) {
      // Re-import updates schedule details but never clobbers entered results.
      await prisma.fixture.update({
        where: { id: existing.id },
        data: {
          startTime: data.startTime,
          lockTime: data.lockTime,
          winnerPoints: data.winnerPoints,
          runnerUpPoints: data.runnerUpPoints,
          side1TeamId: data.side1TeamId,
          side2TeamId: data.side2TeamId,
          ...(existing.winnerSide == null && winnerSide != null
            ? { winnerSide, status: "COMPLETED" as const }
            : {}),
        },
      });
      fixtureId = existing.id;
      updated++;
    } else {
      const fixture = await prisma.fixture.create({ data });
      fixtureId = fixture.id;
      created++;
    }

    for (const [sideIdx, side] of sides.entries()) {
      for (const player of side.players) {
        await prisma.fixturePlayer.upsert({
          where: { fixtureId_playerId: { fixtureId, playerId: player.id } },
          create: { fixtureId, playerId: player.id, side: sideIdx + 1 },
          update: { side: sideIdx + 1 },
        });
        const playerRecord = allPlayers.find((p) => p.id === player.id)!;
        await prisma.playerSportAssignment.upsert({
          where: { playerId_sportId: { playerId: player.id, sportId } },
          create: { playerId: player.id, sportId, category: playerRecord.category },
          update: {},
        });
      }
    }
  }

  result.counts.fixturesCreated = created;
  result.counts.fixturesUpdated = updated;

  // Ensure a tournament exists so the countdown works: use the earliest fixture day.
  const activeTournament = await prisma.tournament.findFirst({ where: { isActive: true } });
  if (!activeTournament) {
    const first = await prisma.fixture.findFirst({ orderBy: { startTime: "asc" } });
    if (first) {
      const eventDate = new Date(first.startTime);
      await prisma.tournament.create({
        data: { name: `Sports Day ${eventDate.getFullYear()}`, eventDate },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function importWorkbook(buffer: Buffer): Promise<ImportResult> {
  const result: ImportResult = {
    ok: false,
    detected: "unknown",
    errors: [],
    warnings: [],
    counts: {},
  };

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  } catch {
    result.errors.push("File is not a valid Excel workbook.");
    return result;
  }

  // Detect format by header signatures
  let isSchedule = false;
  let isAuction = false;
  for (const name of workbook.SheetNames) {
    const rows = sheetRows(workbook, name);
    if (isScheduleSheet(rows)) isSchedule = true;
    const flat = rows.slice(0, 3).flat().map((c) => s(c).toLowerCase());
    if (flat.includes("player category") || flat.includes("player purchased")) {
      isAuction = true;
    }
  }

  try {
    if (isAuction) {
      result.detected = "auction";
      await importAuction(workbook, result);
    } else if (isSchedule) {
      result.detected = "schedule";
      await importSchedule(workbook, result);
    }
  } catch (error) {
    result.errors.push(
      `Import failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (!isAuction && !isSchedule) {
    result.errors.push(
      `Unrecognized workbook. Expected either the Auction file (with 'Player Category' / 'Player Purchased' sheets) or the Games Schedule file (with Sport / Category / Stage / Player-Team columns). Sheets found: ${workbook.SheetNames.join(", ")}`
    );
    return result;
  }

  result.ok = result.errors.length === 0;
  return result;
}
