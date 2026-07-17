"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function FixtureFilters({
  sports,
  categories,
}: {
  sports: string[];
  categories: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/fixtures?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        className="w-40"
        value={params.get("sport") ?? ""}
        onChange={(e) => update("sport", e.target.value)}
      >
        <option value="">All sports</option>
        {sports.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </Select>
      <Select
        className="w-40"
        value={params.get("category") ?? ""}
        onChange={(e) => update("category", e.target.value)}
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </Select>
      <Select
        className="w-36"
        value={params.get("status") ?? ""}
        onChange={(e) => update("status", e.target.value)}
      >
        <option value="">All statuses</option>
        <option value="open">Open to predict</option>
        <option value="live">Live</option>
        <option value="completed">Completed</option>
      </Select>
      {(params.get("sport") || params.get("category") || params.get("status")) && (
        <Button variant="ghost" size="sm" onClick={() => router.push("/fixtures")}>
          Clear
        </Button>
      )}
    </div>
  );
}
