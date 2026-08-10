import { z } from "zod";
import { prisma } from "@/lib/prisma";

/**
 * Awards Ceremony admin configuration.
 *
 * The whole config is stored as a single JSON string in the existing generic
 * `Setting` key/value table (key = "ceremony.config") — no schema change, no
 * new table. It is validated with zod on read, and ANY problem (missing row,
 * malformed JSON, invalid shape) falls back to defaults, so a bad config can
 * never break the live app or the ceremony. Nothing here changes tournament
 * data — it only layers presentation choices on top of the derived awards.
 */

export const CEREMONY_CONFIG_KEY = "ceremony.config";

export const SOUND_CUES = ["runnerUp", "champion", "teamChampion", "funny", "luckyDraw"] as const;
export type SoundCue = (typeof SOUND_CUES)[number];

const customAwardSchema = z.object({
  id: z.string().min(1),
  emoji: z.string().max(8).default("🏅"),
  title: z.string().min(1).max(80),
  winner: z.string().min(1).max(80),
  team: z.string().max(80).optional(),
  subtitle: z.string().max(120).optional(),
});
export type CustomAward = z.infer<typeof customAwardSchema>;

export const ceremonyConfigSchema = z.object({
  version: z.literal(1).default(1),
  /** Award ids (Grand Final fixture ids) to skip. */
  hidden: z.array(z.string()).default([]),
  /** Award ids in the desired order; anything unlisted keeps default order after. */
  order: z.array(z.string()).default([]),
  /**
   * Presenter name per key. Keys are the award id for a category, or
   * "team:champion" / "team:runnerUp" / "team:third" for team slides.
   */
  presenters: z.record(z.string(), z.string().max(80)).default({}),
  /** Optional one-liner shown on a category's reveal, keyed by award id. */
  descriptions: z.record(z.string(), z.string().max(160)).default({}),
  /**
   * Presentation-only winner overrides, keyed by award id. A set value
   * replaces the displayed champion / runner-up name for the Awards Day
   * ceremony ONLY — it never touches the real match result, predictions,
   * points, leaderboard, stats or progression. Unset → the auto winner is used.
   */
  winners: z
    .record(
      z.string(),
      z.object({
        champion: z.string().max(80).optional(),
        runnerUp: z.string().max(80).optional(),
      })
    )
    .default({}),
  speeches: z
    .object({ opening: z.string().max(400).optional(), closing: z.string().max(400).optional() })
    .default({}),
  customAwards: z.array(customAwardSchema).default([]),
  sound: z
    .object({
      enabled: z.boolean().default(true),
      style: z.enum(["classic", "fun"]).default("classic"),
      /** Optional hosted audio URL per cue (key ∈ SOUND_CUES); plays instead of the synth. */
      urls: z.record(z.string(), z.string().url()).default({}),
    })
    .default({ enabled: true, style: "classic", urls: {} }),
});

export type CeremonyConfig = z.infer<typeof ceremonyConfigSchema>;

export const DEFAULT_CEREMONY_CONFIG: CeremonyConfig = ceremonyConfigSchema.parse({});

export async function getCeremonyConfig(): Promise<CeremonyConfig> {
  const row = await prisma.setting.findUnique({ where: { key: CEREMONY_CONFIG_KEY } });
  if (!row) return DEFAULT_CEREMONY_CONFIG;
  try {
    return ceremonyConfigSchema.parse(JSON.parse(row.value));
  } catch {
    // Never let a malformed config break the ceremony.
    return DEFAULT_CEREMONY_CONFIG;
  }
}

export async function saveCeremonyConfig(config: CeremonyConfig): Promise<void> {
  const value = JSON.stringify(ceremonyConfigSchema.parse(config));
  await prisma.setting.upsert({
    where: { key: CEREMONY_CONFIG_KEY },
    create: { key: CEREMONY_CONFIG_KEY, value },
    update: { value },
  });
}
