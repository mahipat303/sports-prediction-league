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

/**
 * Presentation-only edit of one program award: its presenter and winner(s).
 * Writes only the ceremony config row — no tournament data is touched.
 */
export async function saveProgramAward(formData: FormData) {
  const id = str(formData, "id");
  if (!id) return;
  const presenter = str(formData, "presenter");
  const male = str(formData, "male");
  const female = str(formData, "female");
  const winner = str(formData, "winner");
  await mutate((c) => {
    if (presenter) c.presenters[id] = presenter.slice(0, 80);
    else delete c.presenters[id];

    const w: { male?: string; female?: string; winner?: string } = {};
    if (male) w.male = male.slice(0, 80);
    if (female) w.female = female.slice(0, 80);
    if (winner) w.winner = winner.slice(0, 80);
    if (w.male || w.female || w.winner) c.programWinners[id] = w;
    else delete c.programWinners[id];
  });
}

/** Opening / closing speeches and all sound settings. */
export async function saveCeremonySettings(formData: FormData) {
  await mutate((c) => {
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

/** Reset all ceremony configuration back to program defaults. */
export async function resetCeremonyConfig() {
  await requireAdmin();
  await saveCeremonyConfig(ceremonyConfigSchema.parse({}));
  revalidatePath("/admin/ceremony");
  revalidatePath("/ceremony");
}
