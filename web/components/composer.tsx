"use client";

import { ArrowUp } from "@phosphor-icons/react";
import { useState } from "react";

import { MicButton } from "@/components/mic-button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export type Said = { audio?: Blob; text?: string };

// One bar: type on the left, send and mic on the right.
export function Composer({
  onSend,
  busy,
  placeholder,
  className,
}: {
  onSend: (said: Said) => void;
  busy: boolean;
  placeholder: string;
  className?: string;
}) {
  const [text, setText] = useState("");
  const ready = !!text.trim() && !busy;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        onSend({ text: text.trim() });
        setText("");
      }}
    >
      <InputGroup className={cn("h-12 rounded-2xl bg-card pl-1.5", className)}>
        <InputGroupInput value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
        <InputGroupAddon align="inline-end" className="gap-1.5 pr-1.5">
          <InputGroupButton
            type="submit"
            size="icon-sm"
            variant={ready ? "default" : "ghost"}
            aria-disabled={!ready}
            aria-label="Send"
            className="rounded-full aria-disabled:text-muted-foreground/60"
          >
            <ArrowUp weight="bold" />
          </InputGroupButton>
          <MicButton busy={busy} onClip={(audio) => onSend({ audio })} />
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
