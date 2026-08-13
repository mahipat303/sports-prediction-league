import { prisma } from "@/lib/prisma";
import { getCeremonyConfig, type SoundCue } from "@/lib/ceremony-config";
import { getCeremonyProgram, type ProgramAward } from "@/lib/ceremony-program";

/**
 * Read-only data for the Awards Day presentation.
 *
 * The ceremony is a curated program of awards (see `ceremony-program.ts`) —
 * sport best-performers, athlete awards, and the team awards — with winners
 * and presenters finalised by the organisers and overridable from the admin
 * config row. This module only reads config + the program and the tournament
 * name; it writes nothing and touches no tournament-critical data.
 */

export interface CeremonySound {
  enabled: boolean;
  style: "classic" | "fun";
  urls: Partial<Record<SoundCue, string>>;
}

export interface CeremonyData {
  program: ProgramAward[];
  speeches: { opening: string | null; closing: string | null };
  sound: CeremonySound;
  tournamentName: string;
  year: number;
}

export async function getCeremonyData(): Promise<CeremonyData> {
  const [tournament, config, program] = await Promise.all([
    prisma.tournament.findFirst({ where: { isActive: true } }),
    getCeremonyConfig(),
    getCeremonyProgram(),
  ]);

  return {
    program,
    speeches: {
      opening: config.speeches.opening ?? null,
      closing: config.speeches.closing ?? null,
    },
    sound: {
      enabled: config.sound.enabled,
      style: config.sound.style,
      urls: config.sound.urls,
    },
    tournamentName: tournament?.name ?? "OpsHub Sports Day",
    year: tournament?.eventDate ? new Date(tournament.eventDate).getFullYear() : new Date().getFullYear(),
  };
}

/** The program for the admin editor (defaults + overrides already applied). */
export async function getCeremonyProgramForAdmin(): Promise<ProgramAward[]> {
  return getCeremonyProgram();
}
