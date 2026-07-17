"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Filter + search controls for the admin Prediction Insights (matches tab). */
export function InsightsFilters({
  sports,
  categories,
  teams,
  users,
}: {
  sports: string[];
  categories: string[];
  teams: { id: string; name: string }[];
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.set("tab", "matches");
    router.push(`/admin/insights?${next.toString()}`);
  }

  const active = ["user", "team", "sport", "category", "confidence", "status", "q"].some(
    (k) => params.get(k)
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search user…"
        defaultValue={params.get("q") ?? ""}
        onChange={(e) => update("q", e.target.value)}
        className="w-44"
      />
      <Select className="w-40" value={params.get("user") ?? ""} onChange={(e) => update("user", e.target.value)}>
        <option value="">All users</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
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
      <Select className="w-36" value={params.get("confidence") ?? ""} onChange={(e) => update("confidence", e.target.value)}>
        <option value="">All confidence</option>
        <option value="LOW">🟢 Low</option>
        <option value="MEDIUM">🟡 Medium</option>
        <option value="HIGH">🔴 High</option>
      </Select>
      <Select className="w-36" value={params.get("status") ?? ""} onChange={(e) => update("status", e.target.value)}>
        <option value="">All statuses</option>
        <option value="SCHEDULED">Scheduled</option>
        <option value="LOCKED">Locked</option>
        <option value="LIVE">Live</option>
        <option value="COMPLETED">Completed</option>
      </Select>
      {active && (
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/insights?tab=matches")}>
          Clear
        </Button>
      )}
    </div>
  );
}

/** Slimmer filters for the Tournament Winner tab (user + team + search). */
export function ChampionFilters({
  teams,
  users,
}: {
  teams: { id: string; name: string }[];
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.set("tab", "champion");
    router.push(`/admin/insights?${next.toString()}`);
  }

  const active = ["user", "team", "q"].some((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search user…"
        defaultValue={params.get("q") ?? ""}
        onChange={(e) => update("q", e.target.value)}
        className="w-44"
      />
      <Select className="w-40" value={params.get("user") ?? ""} onChange={(e) => update("user", e.target.value)}>
        <option value="">All users</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </Select>
      <Select className="w-40" value={params.get("team") ?? ""} onChange={(e) => update("team", e.target.value)}>
        <option value="">All teams</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </Select>
      {active && (
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/insights?tab=champion")}>
          Clear
        </Button>
      )}
    </div>
  );
}
