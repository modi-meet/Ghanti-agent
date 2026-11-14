"use client";

import { SendHorizontal } from "lucide-react";
import { useState } from "react";

import { MicButton } from "@/components/mic-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type Said = { audio?: Blob; text?: string };

// Mic on the left, a text box for when talking isn't an option.
export function Composer({
  onSend,
  busy,
  placeholder,
}: {
  onSend: (said: Said) => void;
  busy: boolean;
  placeholder: string;
}) {
  const [text, setText] = useState("");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim() || busy) return;
        onSend({ text: text.trim() });
        setText("");
      }}
    >
      <MicButton busy={busy} onClip={(audio) => onSend({ audio })} />
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-xl"
      />
      <Button type="submit" size="icon-lg" variant="outline" disabled={busy || !text.trim()} aria-label="Send">
        <SendHorizontal />
      </Button>
    </form>
  );
}
