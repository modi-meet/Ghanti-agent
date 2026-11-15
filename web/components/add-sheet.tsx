"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// The by-hand way in: a button that opens a short form. Everything it saves
// could also have been said to Ghanti in Chat.
export function AddSheet({
  button,
  title,
  hint,
  save = "Save",
  onSave,
  children,
}: {
  button: React.ReactNode;
  title: string;
  hint?: string;
  save?: string;
  onSave: (values: Record<string, string>) => Promise<unknown>;
  children: React.ReactNode;
}) {
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>);
      // Every tab reads the same school data, so refresh them all.
      mutate((key) => typeof key === "string" && key.startsWith("/teacher/") && key !== "/teacher/chat");
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{button}</SheetTrigger>
      <SheetContent>
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {hint && <SheetDescription>{hint}</SheetDescription>}
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-1">{children}</div>
          <SheetFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : save}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

// A native select, dressed like the shadcn Input next to it.
export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}
