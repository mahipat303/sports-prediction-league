"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Filter + search controls for the public Schedule page. */
export function ScheduleFilters({
  dates,
  sports,
  categories,
  teams,
}: {
  dates: { value: string; label: string }[];
  sports: string[];
  categories: string[];
  teams: { id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/schedule?${next.toString()}`);
  }

  const active = ["date", "sport", "category", "team", "status", "q"].some((k) =>
    params.get(k)
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search team, player, sport…"
        defaultValue={params.get("q") ?? ""}
        onChange={(e) => update("q", e.target.value)}
        className="w-52"
      />
      <Select className="w-40" value={params.get("date") ?? ""} onChange={(e) => update("date", e.target.value)}>
        <option value="">All dates</option>
        {dates.map((d) => (
          <option key={d.value} value={d.value}>{d.label}</option>
        ))}
      </Select>
      <Select className="w-36" value={params.get("sport") ?? ""} onChange={(e) => update("sport", e.target.value)}>
        <option value="">All sports</option>
        {sports.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </Select>
      <Select className="w-40" value={params.get("category") ?? ""} onChange={(e) => update("category", e.target.value)}>
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </Select>
      <Select className="w-40" value={params.get("team") ?? ""} onChange={(e) => update("team", e.target.value)}>
        <option value="">All teams</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </Select>
      <Select className="w-36" value={params.get("status") ?? ""} onChange={(e) => update("status", e.target.value)}>
        <option value="">All statuses</option>
        <option value="upcoming">🟢 Upcoming</option>
        <option value="live">🟡 Live</option>
        <option value="completed">✅ Completed</option>
        <option value="cancelled">❌ Cancelled</option>
      </Select>
      {active && (
        <Button variant="ghost" size="sm" onClick={() => router.push("/schedule")}>
          Clear
        </Button>
      )}
    </div>
  );
}
