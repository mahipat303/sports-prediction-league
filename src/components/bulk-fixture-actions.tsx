"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { bulkUpdateFixtures } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

export interface BulkFixture {
  id: string;
  label: string; // "Chess · Male Singles · Dev vs Abhi"
  status: string;
  startTime: string;
  sport: string;
  stage: string;
  category: string;
  day: string; // IST yyyy-mm-dd
  dayLabel: string;
}

type Action = "date" | "time" | "datetime" | "status" | "openPredictions" | "closePredictions";

const ACTIONS: { value: Action; label: string; input: "date" | "time" | "datetime-local" | "status" | "none" }[] = [
  { value: "date", label: "Change date", input: "date" },
  { value: "time", label: "Change time", input: "time" },
  { value: "datetime", label: "Change date & time", input: "datetime-local" },
  { value: "status", label: "Set status", input: "status" },
  { value: "openPredictions", label: "Open predictions", input: "none" },
  { value: "closePredictions", label: "Close predictions", input: "none" },
];

/**
 * Checkbox selection + bulk actions for the admin Fixtures list.
 * Extensible: add a new entry to ACTIONS and a matching case server-side.
 */
export function BulkFixtureActions({
  fixtures,
  sports,
  stages,
}: {
  fixtures: BulkFixture[];
  sports: string[];
  stages: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Filters are local state, not URL params: navigating would remount this
  // component and silently discard a half-built selection.
  const [fStatus, setFStatus] = useState("");
  const [fSport, setFSport] = useState("");
  const [fStage, setFStage] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fDay, setFDay] = useState("");
  const [action, setAction] = useState<Action>("datetime");
  const [value, setValue] = useState("");
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  const spec = ACTIONS.find((a) => a.value === action)!;
  const chosen = fixtures.filter((f) => selected.has(f.id));
  const completedCount = chosen.filter((f) => f.status === "COMPLETED").length;
  const needsValue = spec.input !== "none";
  const canApply = chosen.length > 0 && (!needsValue || value !== "");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const visible = fixtures.filter(
    (f) =>
      (!fStatus || f.status === fStatus) &&
      (!fSport || f.sport === fSport) &&
      (!fStage || f.stage === fStage) &&
      (!fCategory || f.category === fCategory) &&
      (!fDay || f.day === fDay)
  );
  const categories = [...new Set(fixtures.map((f) => f.category))].sort();
  const days = [...new Map(fixtures.map((f) => [f.day, f.dayLabel])).entries()].sort(
    ([a], [b]) => a.localeCompare(b)
  );
  const filtersActive = Boolean(fStatus || fSport || fStage || fCategory || fDay);

  // "Select all" acts on what's visible, so a filter narrows the target set.
  const allVisibleSelected =
    visible.length > 0 && visible.every((f) => selected.has(f.id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((f) => next.delete(f.id));
      else visible.forEach((f) => next.add(f.id));
      return next;
    });
  const hiddenSelected = selected.size - visible.filter((f) => selected.has(f.id)).length;

  function apply() {
    const fd = new FormData();
    fd.set("ids", [...selected].join(","));
    fd.set("action", action);
    fd.set("value", value);
    if (includeCompleted) fd.set("includeCompleted", "on");
    startTransition(async () => {
      const res = await bulkUpdateFixtures(fd);
      setConfirming(false);
      if (res?.error) {
        setResult(res.error);
      } else {
        setResult(
          `${res?.updated ?? 0} fixture${res?.updated === 1 ? "" : "s"} updated successfully.` +
            (res?.skipped ? ` ${res.skipped} completed fixture(s) skipped.` : "")
        );
        setSelected(new Set());
        setValue("");
        router.refresh();
      }
      setTimeout(() => setResult(null), 6000);
    });
  }

  return (
    <div className="space-y-3">
      {/* Narrow the list before selecting. Selection survives filter changes. */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={fSport} onChange={(e) => setFSport(e.target.value)} className="w-full sm:w-36">
          <option value="">All sports</option>
          {sports.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-full sm:w-36">
          <option value="">All statuses</option>
          {["SCHEDULED", "LOCKED", "LIVE", "COMPLETED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <Select value={fStage} onChange={(e) => setFStage(e.target.value)} className="w-full sm:w-40">
          <option value="">All stages</option>
          {stages.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={fCategory} onChange={(e) => setFCategory(e.target.value)} className="w-full sm:w-40">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={fDay} onChange={(e) => setFDay(e.target.value)} className="w-full sm:w-44">
          <option value="">All dates</option>
          {days.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFStatus(""); setFSport(""); setFStage(""); setFCategory(""); setFDay(""); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={toggleAll} className="gap-1.5" disabled={visible.length === 0}>
          {allVisibleSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          {allVisibleSelected ? "Clear shown" : `Select shown (${visible.length})`}
        </Button>
        <Badge variant="secondary">{selected.size} selected</Badge>
        {hiddenSelected > 0 && (
          <span className="text-xs text-amber-500">
            ⚠️ {hiddenSelected} selected {hiddenSelected === 1 ? "match is" : "matches are"} hidden by the filters
          </span>
        )}

        <Select value={action} onChange={(e) => { setAction(e.target.value as Action); setValue(""); }} className="w-52">
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </Select>

        {spec.input === "status" ? (
          <Select value={value} onChange={(e) => setValue(e.target.value)} className="w-40">
            <option value="">Choose status…</option>
            <option value="SCHEDULED">Upcoming</option>
            <option value="LIVE">Live</option>
            <option value="LOCKED">Locked</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        ) : spec.input !== "none" ? (
          <Input
            type={spec.input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-52"
          />
        ) : null}

        <Button size="sm" disabled={!canApply || pending} onClick={() => setConfirming(true)}>
          Apply to {chosen.length}
        </Button>
        {result && <span className="text-xs font-medium text-emerald-500">{result}</span>}
      </div>

      {/* Selection list */}
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border/50 p-2">
        {visible.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No fixtures match these filters. 🔍
          </p>
        )}
        {visible.map((f) => (
          // A plain row (not a <label>) — wrapping a checkbox in a label makes
          // a click on the box itself toggle twice and cancel out.
          <div
            key={f.id}
            role="checkbox"
            aria-checked={selected.has(f.id)}
            tabIndex={0}
            onClick={() => toggle(f.id)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(f.id); }
            }}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent",
              selected.has(f.id) && "bg-accent/60"
            )}
          >
            <input
              type="checkbox"
              checked={selected.has(f.id)}
              readOnly
              tabIndex={-1}
              className="pointer-events-none accent-indigo-500"
            />
            <span className="min-w-0 flex-1 truncate">{f.label}</span>
            <span className="text-xs text-muted-foreground">{f.startTime}</span>
            {f.status === "COMPLETED" && <Badge variant="success">Completed</Badge>}
          </div>
        ))}
      </div>

      <Modal open={confirming} onClose={() => !pending && setConfirming(false)} title="Confirm bulk update">
        <div className="space-y-4 text-sm">
          <p>
            Apply <strong>{spec.label}</strong>
            {needsValue && <> → <strong>{value}</strong></>} to{" "}
            <strong>{chosen.length}</strong> fixture{chosen.length === 1 ? "" : "s"}?
          </p>
          {completedCount > 0 && (
            <div className="space-y-2 rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-3">
              <p className="flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" /> {completedCount} completed fixture(s) selected
              </p>
              <p className="text-xs text-muted-foreground">
                Completed matches are historical — their times feed bonus
                calculations. They are skipped unless you tick this.
              </p>
              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={includeCompleted}
                  onChange={(e) => setIncludeCompleted(e.target.checked)}
                  className="accent-amber-500"
                />
                Include completed fixtures anyway
              </label>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Predictions, results, points and leaderboards are never modified.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={apply} disabled={pending}>
              {pending ? "Applying…" : "Confirm"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
