"use client";

import { BellRing, Phone, PhoneOff, SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { MicButton } from "@/components/mic-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, say, type Exchange, type Turn } from "@/lib/api";
import { play, stop, unlock, usePlaying } from "@/lib/player";
import { cn } from "@/lib/utils";

export type SchoolMessage = {
  id: number;
  kind: "homework" | "weekly" | "reply";
  title: string;
  script: string;
  heard: boolean;
  audio_url: string;
  created_at: string;
};

type Said = { audio?: Blob; text?: string };
type Started = { conversation_id: number; opening: Turn | null };

// The website's stand-in for a phone call from the school. It rings, the parent
// picks up and hears the message, then holds the button to ask anything.
export function CallScreen({
  message,
  ring,
  callKey,
  caller,
  onClose,
}: {
  message?: SchoolMessage; // none means the parent rang the school themselves
  ring?: boolean;
  callKey: number; // new for every call, so two calls never share a result
  caller: string;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<"ringing" | "live">(ring ? "ringing" : "live");
  const [asked, setAsked] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const speaking = usePlaying() !== null;
  const bottom = useRef<HTMLDivElement>(null);

  // Picking up creates the call on the server, once. SWR is only here to run it
  // when the stage turns live and hold the result, so every revalidation is off.
  const { data: call } = useSWR(
    stage === "live" ? ["parent-call", callKey] : null,
    () => api<Started>("/parent/calls", { method: "POST", json: { message_id: message?.id ?? null } }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      shouldRetryOnError: false,
      onSuccess: (c) => c.opening?.audio_url && play(c.opening.audio_url),
      onError: (e: Error) => {
        toast.error(e.message);
        onClose();
      },
    },
  );
  const callId = call?.conversation_id ?? null;
  const turns = [...(call?.opening ? [call.opening] : []), ...asked];

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [turns.length, busy]);

  function pickUp() {
    unlock();
    setStage("live");
  }

  async function send(said: Said) {
    if (!callId) return;
    stop();
    setBusy(true);
    try {
      const exchange = await say<Exchange>(`/parent/calls/${callId}/talk`, said);
      setAsked((old) => [...old, exchange.user, exchange.assistant]);
      if (exchange.assistant.audio_url) play(exchange.assistant.audio_url);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  }

  function hangUp() {
    stop();
    // Fire and forget: the server writes the teacher's summary after we've left.
    if (callId) api(`/parent/calls/${callId}/end`, { method: "POST" }).catch(() => {});
    onClose();
  }

  const status = busy ? "Thinking…" : speaking ? "Speaking…" : callId ? "Hold the button and ask anything" : "Connecting…";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-neutral-50">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-hidden px-5 pt-10 pb-6">
        <div className="flex flex-col items-center text-center">
          <div className="relative grid size-20 place-items-center rounded-full bg-voice text-voice-foreground">
            {(stage === "ringing" || speaking) && (
              <span className="absolute inset-0 animate-ping rounded-full bg-voice/40" />
            )}
            <BellRing className={cn("relative size-8", stage === "ringing" && "animate-bounce")} />
          </div>
          <div className="mt-4 text-xl font-semibold tracking-tight">{caller}</div>
          <div className="mt-1 text-sm text-neutral-400">
            {stage === "ringing" ? (message?.title ?? "Incoming call") : status}
          </div>
        </div>

        {stage === "ringing" ? (
          <div className="mt-auto flex items-center justify-around pb-6">
            <RoundButton label="Later" onClick={onClose} className="bg-red-600">
              <PhoneOff className="size-6" />
            </RoundButton>
            <RoundButton label="Answer" onClick={pickUp} className="bg-emerald-600">
              <Phone className="size-6" />
            </RoundButton>
          </div>
        ) : (
          <>
            <div className="mt-8 flex-1 space-y-3 overflow-y-auto pr-1">
              {turns.map((t) => (
                <div key={t.id} className={cn("flex", t.role === "user" && "justify-end")}>
                  <p
                    className={cn(
                      "max-w-[88%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed",
                      t.role === "user" ? "rounded-br-md bg-neutral-50 text-neutral-900" : "rounded-bl-md bg-neutral-800",
                    )}
                  >
                    {t.text}
                  </p>
                </div>
              ))}
              <div ref={bottom} />
            </div>

            <div className="mt-4 grid grid-cols-3 items-end">
              <div />
              <div className="flex justify-center">
                <MicButton large busy={busy || !callId} onClip={(audio) => send({ audio })} />
              </div>
              <div className="flex justify-end">
                <RoundButton label="End" onClick={hangUp} className="size-12 bg-red-600">
                  <PhoneOff className="size-5" />
                </RoundButton>
              </div>
            </div>
            <form
              className="mt-5 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!text.trim() || busy) return;
                send({ text: text.trim() });
                setText("");
              }}
            >
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="or type your question"
                className="h-10 rounded-xl border-neutral-700 bg-neutral-900 text-neutral-50 placeholder:text-neutral-500"
              />
              <Button type="submit" size="icon-lg" variant="secondary" disabled={busy || !text.trim()} aria-label="Send">
                <SendHorizontal />
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function RoundButton({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={label}
        className={cn("grid size-16 place-items-center rounded-full text-white transition-transform active:scale-95", className)}
        {...props}
      >
        {children}
      </button>
      <span className="text-xs text-neutral-400">{label}</span>
    </div>
  );
}
