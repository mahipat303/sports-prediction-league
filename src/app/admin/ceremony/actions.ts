"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  getCeremonyConfig,
  saveCeremonyConfig,
  ceremonyConfigSchema,
  SOUND_CUES,
  type CeremonyConfig,
} from "@/lib/ceremony-config";

/** Load, mutate and persist the single config row. Admin-only. */
async function mutate(fn: (c: CeremonyConfig) => void) {
  await requireAdmin();
  const config = await getCeremonyConfig();
  fn(config);
  await saveCeremonyConfig(config);
  revalidatePath("/admin/ceremony");
  revalidatePath("/ceremony");
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Per-category presenter + description + visibility. */
export async function saveAward(formData: FormData) {
  const id = str(formData, "awardId");
  if (!id) return;
  const presenter = str(formData, "presenter");
  const description = str(formData, "description");
  const hidden = formData.get("hidden") === "on";
  await mutate((c) => {
    if (presenter) c.presenters[id] = presenter.slice(0, 80);
    else delete c.presenters[id];
    if (description) c.descriptions[id] = description.slice(0, 160);
    else delete c.descriptions[id];
    c.hidden = c.hidden.filter((h) => h !== id);
    if (hidden) c.hidden.push(id);
  });
}

/**
 * Presentation-only winner override for a category award. Sets or clears the
 * displayed champion / runner-up for Awards Day. Never touches the fixture,
 * result or any derived data — it only writes the ceremony config row.
 */
export async function setAwardWinner(formData: FormData) {
  const id = str(formData, "awardId");
  const which = str(formData, "which"); // "champion" | "runnerUp"
  const value = str(formData, "value"); // empty string = reset to auto
  if (!id || (which !== "champion" && which !== "runnerUp")) return;
  await mutate((c) => {
    const entry = { ...(c.winners[id] ?? {}) };
    if (value) entry[which] = value.slice(0, 80);
    else delete entry[which];
    if (entry.champion || entry.runnerUp) c.winners[id] = entry;
    else delete c.winners[id];
  });
}

/** Move an award one place earlier/later in the ceremony order. */
export async function moveAward(formData: FormData) {
  const id = str(formData, "awardId");
  const dir = str(formData, "dir");
  const orderedIds = str(formData, "orderedIds").split(",").filter(Boolean);
  if (!id || !orderedIds.length) return;
  await mutate((c) => {
    // Start from the currently-displayed order so the move is relative to what
    // the admin sees, then swap with the neighbour.
    const arr = [...orderedIds];
    const i = arr.indexOf(id);
    if (i < 0) return;
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    c.order = arr;
  });
}

/** Team presenters, speeches, and all sound settings in one form. */
export async function saveCeremonySettings(formData: FormData) {
  await mutate((c) => {
    for (const place of ["champion", "runnerUp", "third"] as const) {
      const name = str(formData, `team_${place}`);
      const key = `team:${place}`;
      if (name) c.presenters[key] = name.slice(0, 80);
      else delete c.presenters[key];
    }
    c.speeches = {
      opening: str(formData, "opening").slice(0, 400) || undefined,
      closing: str(formData, "closing").slice(0, 400) || undefined,
    };
    const urls: Record<string, string> = {};
    for (const cue of SOUND_CUES) {
      const u = str(formData, `sound_${cue}`);
      if (u) urls[cue] = u;
    }
    c.sound = {
      enabled: formData.get("sound_enabled") === "on",
      style: str(formData, "sound_style") === "fun" ? "fun" : "classic",
      urls,
    };
  });
}

export async function addCustomAward(formData: FormData) {
  const title = str(formData, "title");
  const winner = str(formData, "winner");
  if (!title || !winner) return;
  await mutate((c) => {
    c.customAwards.push({
      id: `custom_${Date.now().toString(36)}`,
      emoji: str(formData, "emoji").slice(0, 8) || "🏅",
      title: title.slice(0, 80),
      winner: winner.slice(0, 80),
      team: str(formData, "team").slice(0, 80) || undefined,
      subtitle: str(formData, "subtitle").slice(0, 120) || undefined,
    });
  });
}

export async function removeCustomAward(formData: FormData) {
  const id = str(formData, "id");
  await mutate((c) => {
    c.customAwards = c.customAwards.filter((a) => a.id !== id);
  });
}

/** Wipe all ceremony configuration back to defaults. */
export async function resetCeremonyConfig() {
  await requireAdmin();
  await saveCeremonyConfig(ceremonyConfigSchema.parse({}));
  revalidatePath("/admin/ceremony");
  revalidatePath("/ceremony");
}
