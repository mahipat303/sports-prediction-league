import { prisma } from "@/lib/prisma";
import { getCeremonyConfig } from "@/lib/ceremony-config";

/**
 * The Awards Day program.
 *
 * The ceremony is a curated, ordered list of awards — sport "best performer"
 * awards (a male + a female winner each), the special athlete awards, and the
 * team awards. Winners and presenters are finalised by the organisers, so they
 * live here as data rather than being derived from fixtures. This is purely a
 * presentation program: it reads nothing tournament-critical and writes
 * nothing. Next year, edit this list (or the admin overrides) — no code change
 * to the deck is needed.
 *
 * Admin overrides (presenter name + winners) are layered on top from the
 * ceremony config row, so the organisers can tweak any entry without a deploy.
 */

export type ProgramKind = "sport" | "athlete" | "team";

export interface ProgramAward {
  id: string;
  kind: ProgramKind;
  emoji: string;
  title: string;
  presenter: string;
  /** Sport awards carry two winners. */
  male?: string;
  female?: string;
  /** Athlete / team awards carry a single winner label. */
  winner?: string;
  /** Resolved team accent for team awards (display only). */
  teamColor?: string | null;
  /** The champion team — the biggest celebration of the night. */
  champion?: boolean;
}

export const DEFAULT_PROGRAM: ProgramAward[] = [
  { id: "tt", kind: "sport", emoji: "🏓", title: "Table Tennis", presenter: "Dev", male: "Kabir/Mahir", female: "Jayswee" },
  { id: "badminton", kind: "sport", emoji: "🏸", title: "Badminton", presenter: "Puneet", male: "Deepanshu/Devang", female: "Jahnavi" },
  { id: "carrom", kind: "sport", emoji: "🎯", title: "Carrom", presenter: "Priyanka M", male: "Purvang", female: "Dhruvi" },
  { id: "chess", kind: "sport", emoji: "♟️", title: "Chess", presenter: "Yashvi", male: "Akash", female: "Dhara" },
  { id: "pickleball", kind: "sport", emoji: "🎾", title: "Pickle Ball", presenter: "Chinmai", male: "Bhavik", female: "Jahnavi" },
  { id: "volleyball", kind: "sport", emoji: "🏐", title: "Volleyball", presenter: "Jay", male: "Chintan", female: "Nency" },
  { id: "cricket", kind: "sport", emoji: "🏏", title: "Cricket", presenter: "Rajvi", male: "Sanjay", female: "Nency" },
  { id: "best_female", kind: "athlete", emoji: "🌟", title: "Best Female Athlete", presenter: "Greshi", winner: "Jahnavi + Jayswee" },
  { id: "best_male", kind: "athlete", emoji: "🌟", title: "Best Male Athlete", presenter: "Vishwa", winner: "Chintan + Niraj" },
  { id: "emerging_female", kind: "athlete", emoji: "🌱", title: "Best Emerging Female Athlete", presenter: "Paarth", winner: "Dhara" },
  { id: "emerging_male", kind: "athlete", emoji: "🌱", title: "Best Emerging Male Athlete", presenter: "Gaurav K", winner: "Ayush" },
  { id: "runner_up_team", kind: "team", emoji: "🥈", title: "Runners-up Team", presenter: "Riya", winner: "Team Kabir" },
  { id: "champion_team", kind: "team", emoji: "🏆", title: "Champions", presenter: "Amol", winner: "Team Abhi", champion: true },
];

/** Best-effort office-team accent for a "Team X" label (display only). */
function teamColorFor(label: string, teams: { name: string; color: string }[]): string | null {
  const owner = label.replace(/^team\s+/i, "").trim().toLowerCase();
  const match = teams.find((t) => t.name.toLowerCase().includes(owner));
  return match?.color ?? null;
}

/**
 * The program with admin overrides applied. Presenter names come from
 * `config.presenters[id]`; winners from `config.programWinners[id]`.
 */
export async function getCeremonyProgram(): Promise<ProgramAward[]> {
  const [config, teams] = await Promise.all([
    getCeremonyConfig(),
    prisma.team.findMany({ select: { name: true, color: true } }),
  ]);
  return DEFAULT_PROGRAM.map((a) => {
    const w = config.programWinners[a.id] ?? {};
    const merged: ProgramAward = {
      ...a,
      presenter: config.presenters[a.id] || a.presenter,
      male: w.male ?? a.male,
      female: w.female ?? a.female,
      winner: w.winner ?? a.winner,
    };
    if (merged.kind === "team" && merged.winner) {
      merged.teamColor = teamColorFor(merged.winner, teams);
    }
    return merged;
  });
}
