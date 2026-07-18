"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { updateResult } from "@/app/admin/actions";

/** Inline editor for an already-published result, with a confirmation step. */
export function EditResultForm({
  fixtureId,
  side1Label,
  side2Label,
  winnerSide,
  scoreSummary,
  isUpset,
}: {
  fixtureId: string;
  side1Label: string;
  side2Label: string;
  winnerSide: number;
  scoreSummary: string | null;
  isUpset: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [form, setForm] = useState({
    winnerSide: String(winnerSide),
    scoreSummary: scoreSummary ?? "",
    isUpset,
  });
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function save() {
    const fd = new FormData();
    fd.set("fixtureId", fixtureId);
    fd.set("winnerSide", form.winnerSide);
    fd.set("scoreSummary", form.scoreSummary);
    if (form.isUpset) fd.set("isUpset", "on");
    startTransition(async () => {
      const result = await updateResult(fd);
      setConfirming(false);
      if (result?.error) {
        setMessage(result.error);
      } else {
        setMessage(null);
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="gap-1" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" /> Edit Result
      </Button>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={form.winnerSide}
          onChange={(e) => setForm({ ...form, winnerSide: e.target.value })}
          className="w-44"
          aria-label="Winner"
        >
          <option value="1">{side1Label}</option>
          <option value="2">{side2Label}</option>
        </Select>
        <Input
          value={form.scoreSummary}
          onChange={(e) => setForm({ ...form, scoreSummary: e.target.value })}
          placeholder="Score (optional)"
          className="w-32"
        />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={form.isUpset}
            onChange={(e) => setForm({ ...form, isUpset: e.target.checked })}
            className="accent-indigo-500"
          />
          Upset win
        </label>
        <Button size="sm" onClick={() => setConfirming(true)} disabled={pending}>
          Save changes
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
        {message && <span className="text-xs text-red-500">{message}</span>}
      </div>

      <Modal open={confirming} onClose={() => !pending && setConfirming(false)}>
        <div className="space-y-4 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h2 className="text-lg font-bold">⚠️ Update Match Result?</h2>
          <p className="text-sm text-muted-foreground">
            Changing this result may recalculate prediction points and update
            the leaderboard.
          </p>
          <p className="rounded-xl bg-muted/50 p-3 text-sm">
            New winner:{" "}
            <strong>{form.winnerSide === "1" ? side1Label : side2Label}</strong>
            {form.scoreSummary && (
              <>
                {" "}· Score: <span className="font-mono">{form.scoreSummary}</span>
              </>
            )}
          </p>
          <p className="text-sm font-medium">Are you sure you want to continue?</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={save} disabled={pending}>
              {pending ? "Updating…" : "Update Result"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
