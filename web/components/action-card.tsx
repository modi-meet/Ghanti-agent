"use client";

import { BookOpen, CalendarCheck, Check, IndianRupee, StickyNote, Undo2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { api, type Action } from "@/lib/api";
import { cn } from "@/lib/utils";

const ICONS = { homework: BookOpen, attendance: CalendarCheck, note: StickyNote, fee: IndianRupee };

// The receipt for one thing the agent did. Undo it, or for money, confirm it first.
export function ActionCard({ action, onChange }: { action: Action; onChange: () => void }) {
  const [status, setStatus] = useState(action.status);
  const [busy, setBusy] = useState(false);
  const Icon = ICONS[action.kind];

  async function act(verb: "undo" | "confirm") {
    setBusy(true);
    try {
      const res = await api<{ status: Action["status"] }>(`/teacher/actions/${action.id}/${verb}`, { method: "POST" });
      setStatus(res.status);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className={cn("rounded-xl border bg-card p-3", status === "undone" && "opacity-60")}>
      <div className="flex items-start gap-2.5">
        <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted">
          <Icon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("text-sm font-medium", status === "undone" && "line-through")}>{action.title}</div>
          {action.lines.map((line) => (
            <div key={line} className="text-xs text-muted-foreground">
              {line}
            </div>
          ))}
        </div>
        {status === "pending" && <Chip tone="warn">Not saved yet</Chip>}
        {status === "undone" && <Chip>Undone</Chip>}
      </div>
      {status !== "undone" && (
        <div className="mt-2.5 flex justify-end gap-2">
          {status === "pending" ? (
            <>
              <Button variant="ghost" size="xs" disabled={busy} onClick={() => act("undo")}>
                <X /> Cancel
              </Button>
              <Button size="xs" disabled={busy} onClick={() => act("confirm")}>
                <Check /> Confirm
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="xs" disabled={busy} onClick={() => act("undo")}>
              <Undo2 /> Undo
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
