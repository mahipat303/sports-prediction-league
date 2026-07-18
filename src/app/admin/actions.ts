"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { evaluateFixture, evaluateChampionPredictions, recomputeLeaderboardEntry, getSettings, DEFAULT_SETTINGS, type SettingKey } from "@/lib/scoring";
import { importWorkbook, type ImportResult } from "@/lib/excel-import";
import { resolvePlayerFixtures, reresolveAllFixtures } from "@/lib/fixture-resolution";
import { NotificationType, PlayerCategory } from "@prisma/client";

function revalidateAll() {
  for (const path of ["/", "/fixtures", "/teams", "/players", "/leaderboard", "/stats", "/admin"]) {
    revalidatePath(path, "layout");
  }
}

// ---------- Excel import ----------
export async function importExcel(formData: FormData): Promise<ImportResult> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, detected: "unknown", errors: ["No file uploaded"], warnings: [], counts: {} };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, detected: "unknown", errors: ["File too large (max 10 MB)"], warnings: [], counts: {} };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await importWorkbook(buffer);
  if (result.ok) revalidateAll();
  return result;
}

// ---------- Results ----------
const resultSchema = z.object({
  fixtureId: z.string().min(1),
  winnerSide: z.coerce.number().int().min(1).max(2),
  scoreSummary: z.string().max(60).optional(),
  isUpset: z.boolean().default(false),
});

export async function enterResult(formData: FormData) {
  await requireAdmin();
  const parsed = resultSchema.safeParse({
    fixtureId: formData.get("fixtureId"),
    winnerSide: formData.get("winnerSide"),
    scoreSummary: formData.get("scoreSummary") || undefined,
    isUpset: formData.get("isUpset") === "on",
  });
  if (!parsed.success) { console.warn("Invalid result data"); return; }
  const { fixtureId, winnerSide, scoreSummary, isUpset } = parsed.data;

  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId } });
  if (!fixture) { console.warn("Fixture not found"); return; }

  await prisma.fixture.update({
    where: { id: fixtureId },
    data: {
      winnerSide,
      scoreSummary: scoreSummary ?? null,
      isUpset,
      status: "COMPLETED",
    },
  });

  await evaluateFixture(fixtureId);
  revalidateAll();
  return;
}

/**
 * Correct an already-published result. Records an audit entry, updates the
 * fixture, and re-runs scoring idempotently (points replaced, day bonuses
 * recomputed, leaderboard refreshed). Called from the client edit form, so it
 * returns a result object.
 */
export async function updateResult(formData: FormData) {
  const session = await requireAdmin();
  const parsed = resultSchema.safeParse({
    fixtureId: formData.get("fixtureId"),
    winnerSide: formData.get("winnerSide"),
    scoreSummary: formData.get("scoreSummary") || undefined,
    isUpset: formData.get("isUpset") === "on",
  });
  if (!parsed.success) return { error: "Invalid result data" };
  const { fixtureId, winnerSide, scoreSummary, isUpset } = parsed.data;

  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId } });
  if (!fixture) return { error: "Fixture not found" };
  if (fixture.status !== "COMPLETED") {
    return { error: "Only published results can be edited" };
  }

  await prisma.resultEdit.create({
    data: {
      fixtureId,
      editedById: session.user.id,
      editedByName: session.user.name ?? "Admin",
      prevWinnerSide: fixture.winnerSide,
      newWinnerSide: winnerSide,
      prevScore: fixture.scoreSummary,
      newScore: scoreSummary ?? null,
    },
  });

  await prisma.fixture.update({
    where: { id: fixtureId },
    data: { winnerSide, scoreSummary: scoreSummary ?? null, isUpset },
  });

  await evaluateFixture(fixtureId, "reevaluate");
  revalidateAll();
  return { success: true };
}

// ---------- Fixture lifecycle ----------
export async function setFixtureStatus(formData: FormData) {
  await requireAdmin();
  const fixtureId = String(formData.get("fixtureId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["SCHEDULED", "LOCKED", "LIVE", "CANCELLED"].includes(status)) {
    console.warn("Invalid status"); return;
  }
  await prisma.fixture.update({
    where: { id: fixtureId },
    data: { status: status as "SCHEDULED" | "LOCKED" | "LIVE" | "CANCELLED" },
  });
  revalidateAll();
  return;
}

const fixtureSchema = z.object({
  sportId: z.string().min(1),
  matchCategory: z.string().min(1).max(40),
  stage: z.string().max(60).optional(),
  side1Label: z.string().min(1).max(80),
  side2Label: z.string().min(1).max(80),
  startTime: z.string().min(1),
  venue: z.string().optional(),
  liveUrl: z.string().url().optional().or(z.literal("")),
  winnerPoints: z.coerce.number().min(0).default(0),
});

export async function createFixture(formData: FormData) {
  await requireAdmin();
  const parsed = fixtureSchema.safeParse({
    sportId: formData.get("sportId"),
    matchCategory: formData.get("matchCategory"),
    stage: formData.get("stage") || undefined,
    side1Label: formData.get("side1Label"),
    side2Label: formData.get("side2Label"),
    startTime: formData.get("startTime"),
    venue: formData.get("venue") || undefined,
    liveUrl: formData.get("liveUrl") || "",
    winnerPoints: formData.get("winnerPoints") || 0,
  });
  if (!parsed.success) { console.warn("Invalid fixture data"); return; }
  const data = parsed.data;
  if (data.side1Label.toLowerCase() === data.side2Label.toLowerCase()) {
    console.warn("Sides must be different"); return;
  }

  const startTime = new Date(data.startTime);
  if (isNaN(startTime.getTime())) { console.warn("Invalid start time"); return; }
  const settings = await getSettings();

  await prisma.fixture.create({
    data: {
      sportId: data.sportId,
      matchCategory: data.matchCategory,
      stage: data.stage ?? null,
      side1Label: data.side1Label,
      side2Label: data.side2Label,
      startTime,
      lockTime: new Date(startTime.getTime() - settings.LOCK_MINUTES_BEFORE_START * 60_000),
      venue: data.venue ?? null,
      liveUrl: data.liveUrl || null,
      winnerPoints: data.winnerPoints,
    },
  });
  revalidateAll();
  return;
}

/** Set or clear a fixture's live stream / meeting link. */
export async function setFixtureLiveUrl(formData: FormData) {
  await requireAdmin();
  const fixtureId = String(formData.get("fixtureId") ?? "");
  const raw = String(formData.get("liveUrl") ?? "").trim();
  if (!fixtureId) { console.warn("Missing fixture"); return; }
  if (raw && !/^https?:\/\//i.test(raw)) { console.warn("Invalid URL"); return; }
  await prisma.fixture.update({
    where: { id: fixtureId },
    data: { liveUrl: raw || null },
  });
  revalidateAll();
  return;
}

/** Fill in real participants once earlier rounds resolve a placeholder fixture. */
export async function updateFixtureSides(formData: FormData) {
  await requireAdmin();
  const fixtureId = String(formData.get("fixtureId") ?? "");
  const side1Label = String(formData.get("side1Label") ?? "").trim();
  const side2Label = String(formData.get("side2Label") ?? "").trim();
  if (!fixtureId || !side1Label || !side2Label) { console.warn("Both sides are required"); return; }

  const stillPlaceholder = /^(winner|loser|runner|tbd|qualifier)\b/i;
  await prisma.fixture.update({
    where: { id: fixtureId },
    data: {
      side1Label,
      side2Label,
      isPlaceholder:
        stillPlaceholder.test(side1Label) || stillPlaceholder.test(side2Label),
    },
  });
  revalidateAll();
  return;
}

export async function deleteFixture(formData: FormData) {
  await requireAdmin();
  const fixtureId = String(formData.get("fixtureId") ?? "");
  await prisma.fixture.delete({ where: { id: fixtureId } });
  revalidateAll();
  return;
}

// ---------- Bonus points ----------
export async function awardBonus(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const points = Number(formData.get("points"));
  const reason = String(formData.get("reason") ?? "Admin bonus").trim() || "Admin bonus";
  if (!userId || !Number.isFinite(points) || points === 0) {
    console.warn("Provide a user and a non-zero point value"); return;
  }

  await prisma.pointsHistory.create({
    data: { userId, points, reason: `Bonus: ${reason}` },
  });
  await prisma.notification.create({
    data: {
      userId,
      type: NotificationType.BONUS_AWARDED,
      title: "Bonus points awarded! 🎁",
      message: `${reason}: ${points > 0 ? "+" : ""}${points} points`,
    },
  });
  await recomputeLeaderboardEntry(userId);
  revalidateAll();
  return;
}

// ---------- Users ----------
export async function setUserRole(formData: FormData) {
  const session = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!["USER", "ADMIN"].includes(role)) { console.warn("Invalid role"); return; }
  if (userId === session.user.id && role === "USER") {
    console.warn("You can't demote yourself"); return;
  }
  await prisma.user.update({
    where: { id: userId },
    data: { role: role as "USER" | "ADMIN" },
  });
  revalidatePath("/admin/users");
  return;
}

// ---------- Teams / players ----------
export async function updateTeam(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.team.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? "").trim() || undefined,
      ownerName: String(formData.get("ownerName") ?? "").trim() || undefined,
      color: String(formData.get("color") ?? "").trim() || undefined,
      totalBudget: Number(formData.get("totalBudget")) || undefined,
      remainingBudget: Number(formData.get("remainingBudget")) || undefined,
    },
  });
  revalidateAll();
  return;
}

export async function updatePlayer(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const category = String(formData.get("category") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  await prisma.player.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? "").trim() || undefined,
      category: ["PLATINUM", "GOLD", "SILVER", "BRONZE"].includes(category)
        ? (category as PlayerCategory)
        : undefined,
      auctionPrice: Number(formData.get("auctionPrice")) || undefined,
      teamId: teamId || undefined,
    },
  });
  // Keep historical fixtures consistent with the new assignment (schedule,
  // team stats, standings all read the side-team snapshots).
  await resolvePlayerFixtures(id);
  revalidateAll();
  return;
}

/**
 * Re-derive every fixture's side→team snapshot from current player
 * assignments, retrying name-matching for sides that never linked a player.
 * Display/stats metadata only — predictions and results are untouched.
 */
export async function reresolveFixtures() {
  await requireAdmin();
  const summary = await reresolveAllFixtures();
  console.log(
    `Re-resolve: ${summary.fixturesChecked} fixtures checked, ${summary.sidesUpdated} updated, ${summary.playersLinked} players newly linked`
  );
  revalidateAll();
  return;
}

// ---------- Settings ----------
export async function updateSettings(formData: FormData) {
  await requireAdmin();
  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
    const raw = formData.get(key);
    if (raw == null) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    });
  }
  revalidatePath("/admin/settings");
  return;
}

// ---------- Set tournament date ----------
export async function setTournament(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "Sports Day").trim();
  const eventDate = new Date(String(formData.get("eventDate") ?? ""));
  if (isNaN(eventDate.getTime())) { console.warn("Invalid date"); return; }
  const rawLock = String(formData.get("championLockTime") ?? "");
  const championLockTime = rawLock ? new Date(rawLock) : eventDate;

  // Preserve an existing champion pick / lock if we're just updating the same event.
  const existing = await prisma.tournament.findFirst({ where: { isActive: true } });
  await prisma.tournament.updateMany({ data: { isActive: false } });
  await prisma.tournament.create({
    data: {
      name,
      eventDate,
      isActive: true,
      championLockTime: isNaN(championLockTime.getTime()) ? eventDate : championLockTime,
      championTeamId: existing?.championTeamId ?? null,
    },
  });
  revalidateAll();
  return;
}

// ---------- Declare tournament champion ----------
export async function setChampion(formData: FormData) {
  await requireAdmin();
  const teamId = String(formData.get("teamId") ?? "");
  const tournament = await prisma.tournament.findFirst({ where: { isActive: true } });
  if (!tournament) { console.warn("No active tournament"); return; }

  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { championTeamId: teamId || null },
  });
  if (teamId) await evaluateChampionPredictions(tournament.id);
  revalidateAll();
  return;
}
