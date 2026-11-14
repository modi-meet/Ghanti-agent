"use client";

import { ArrowUUpLeft, BookOpenText, CalendarCheck, Check, CurrencyInr, NotePencil } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";

import { Status } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { api, type Action } from "@/lib/api";
import { cn } from "@/lib/utils";

const ICONS = { homework: BookOpenText, attendance: CalendarCheck, note: NotePencil, fee: CurrencyInr };

// Everything the agent did for one reply, as one list of receipts.
export function ActionList({ actions, onChange }: { actions: Action[]; onChange: () => void }) {
  return (
    <ItemGroup className="gap-0 divide-y overflow-hidden rounded-xl border bg-card">
      {actions.map((a) => (
        <ActionRow key={a.id} action={a} onChange={onChange} />
      ))}
    </ItemGroup>
  );
}

// One receipt. Undo it, or for money, confirm it first.
function ActionRow({ action, onChange }: { action: Action; onChange: () => void }) {
  const [status, setStatus] = useState(action.status);
  const [busy, setBusy] = useState(false);
  const Icon = ICONS[action.kind];
  const undone = status === "undone";

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
    <Item size="sm" className={cn("flex-nowrap rounded-none border-0", status === "pending" && "bg-amber-50/70")}>
      <ItemMedia variant="icon" className={cn(undone && "opacity-40")}>
        <Icon weight="duotone" className="size-5" />
      </ItemMedia>
      <ItemContent className={cn("min-w-0", undone && "opacity-50")}>
        <ItemTitle className={cn(undone && "line-through")}>{action.title}</ItemTitle>
        <ItemDescription className="truncate">{action.lines.join(" · ")}</ItemDescription>
      </ItemContent>
      <ItemActions>
        {undone && <Status>Undone</Status>}
        {status === "pending" && (
          <>
            <Button variant="ghost" size="xs" disabled={busy} onClick={() => act("undo")}>
              Cancel
            </Button>
            <Button size="xs" disabled={busy} onClick={() => act("confirm")}>
              <Check weight="bold" /> Confirm
            </Button>
          </>
        )}
        {status === "applied" && (
          <Button variant="ghost" size="xs" className="text-muted-foreground" disabled={busy} onClick={() => act("undo")}>
            <ArrowUUpLeft /> Undo
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}
