"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { RulesContent, type RulesValues } from "@/components/rules";

/** Help icon + modal with the prediction rules, for the Fixtures page. */
export function RulesDialog({ values }: { values: RulesValues }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <HelpCircle className="h-4 w-4" /> How it works
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="📖 Prediction Rules">
        <RulesContent v={values} />
        <Button className="mt-4 w-full" onClick={() => setOpen(false)}>
          Got it!
        </Button>
      </Modal>
    </>
  );
}
