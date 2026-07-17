"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function PlayerFilters({
  teams,
  sports,
}: {
  teams: string[];
  sports: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");

  // Debounced search
  useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query) next.set("q", query);
      else next.delete("q");
      router.push(`/players?${next.toString()}`);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/players?${next.toString()}`);
  }

  const hasFilters =
    params.get("q") || params.get("team") || params.get("sport") || params.get("category");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="w-52 pl-8"
          placeholder="Search players…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <Select className="w-40" value={params.get("team") ?? ""} onChange={(e) => update("team", e.target.value)}>
        <option value="">All teams</option>
        {teams.map((t) => <option key={t} value={t}>{t}</option>)}
      </Select>
      <Select className="w-40" value={params.get("sport") ?? ""} onChange={(e) => update("sport", e.target.value)}>
        <option value="">All sports</option>
        {sports.map((s) => <option key={s} value={s}>{s}</option>)}
      </Select>
      <Select className="w-36" value={params.get("category") ?? ""} onChange={(e) => update("category", e.target.value)}>
        <option value="">All categories</option>
        <option value="PLATINUM">💎 Platinum</option>
        <option value="GOLD">🥇 Gold</option>
        <option value="SILVER">🥈 Silver</option>
        <option value="BRONZE">🥉 Bronze</option>
      </Select>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuery("");
            router.push("/players");
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
