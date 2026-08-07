import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCeremonyData } from "@/lib/ceremony";
import { CeremonyDeck } from "@/components/ceremony/ceremony-deck";

// Read-only presentation built from finished-tournament data. Rendered per
// request so it always reflects the latest results (e.g. once the champion
// team is declared). Admin-only: it's the finale the organiser runs.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Awards Ceremony · OpsHub Sports Day League",
};

export default async function CeremonyPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const data = await getCeremonyData();
  return <CeremonyDeck data={data} />;
}
