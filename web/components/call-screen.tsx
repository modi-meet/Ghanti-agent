"use client";

import { ArrowUp, BellRinging, Phone, PhoneDisconnect } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { MicButton } from "@/components/mic-button";
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

  const status = busy ? "Thinking" : speaking ? "Speaking" : callId ? "Listening" : "Connecting";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-950 text-stone-50">
      {/* A phone-shaped column. On a wide screen: the call on the left, what was said beside it. */}
      <div
        className={cn(
          "mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-hidden px-5 pt-12 pb-6",
          stage === "live" &&
            "lg:grid lg:max-w-5xl lg:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-[1fr_auto_auto_auto_1fr] lg:gap-x-12 lg:px-8 lg:py-10",
        )}
      >
        <div className="flex flex-col items-center text-center lg:col-start-1 lg:row-start-2">
          <div className="relative grid size-20 place-items-center rounded-full bg-voice text-voice-foreground">
            {stage === "ringing" && <span className="absolute -inset-2 animate-ping rounded-full border-2 border-voice/60" />}
            <BellRinging weight="fill" className={cn("size-9", stage === "ringing" && "animate-bounce")} />
          </div>
          <div className="mt-5 text-xl font-semibold tracking-tight">{caller}</div>
          <div className="mt-1.5 flex h-5 items-center gap-2 text-sm text-stone-400">
            {stage === "ringing" ? (
              (message?.title ?? "Incoming call")
            ) : (
              <>
                {speaking && <Wave />}
                {status}
              </>
            )}
          </div>
        </div>

        {stage === "ringing" ? (
          <div className="mt-auto flex items-center justify-around pb-8">
            <RoundButton label="Later" onClick={onClose} className="bg-red-600">
              <PhoneDisconnect weight="fill" className="size-7" />
            </RoundButton>
            <RoundButton label="Answer" onClick={pickUp} className="bg-emerald-600">
              <Phone weight="fill" className="size-7" />
            </RoundButton>
          </div>
        ) : (
          <>
            <div className="mt-8 flex-1 space-y-3 overflow-y-auto lg:col-start-2 lg:row-span-5 lg:row-start-1 lg:mt-0 lg:min-h-0 lg:rounded-3xl lg:border lg:border-stone-800 lg:bg-stone-900/40 lg:p-6">
              {turns.length === 0 && callId && (
                <p className="hidden h-full place-items-center text-sm text-stone-500 lg:grid">
                  Hold the mic and ask about homework, attendance, fees or how class is going.
                </p>
              )}
              {turns.map((t) => (
                <div key={t.id} className={cn("flex", t.role === "user" && "justify-end")}>
                  <p
                    className={cn(
                      "max-w-[86%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                      t.role === "user" ? "rounded-br-md bg-stone-50 text-stone-900" : "rounded-bl-md bg-stone-800/80",
                    )}
                  >
                    {t.text}
                  </p>
                </div>
              ))}
              <div ref={bottom} />
            </div>

            <div className="mt-5 grid grid-cols-3 items-center lg:col-start-1 lg:row-start-3 lg:mt-10">
              <div />
              <div className="flex flex-col items-center gap-2">
                <MicButton large busy={busy || !callId} onClip={(audio) => send({ audio })} />
                <span className="text-xs text-stone-400">Hold to talk</span>
              </div>
              <div className="flex justify-end">
                <RoundButton label="End" onClick={hangUp} className="size-12 bg-red-600">
                  <PhoneDisconnect weight="fill" className="size-5" />
                </RoundButton>
              </div>
            </div>

            <form
              className="mt-5 flex h-11 items-center gap-1.5 rounded-full border border-stone-800 bg-stone-900 pr-1.5 pl-4 lg:col-start-1 lg:row-start-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!text.trim() || busy) return;
                send({ text: text.trim() });
                setText("");
              }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="or type your question"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-500"
              />
              <button
                type="submit"
                disabled={busy || !text.trim()}
                aria-label="Send"
                className="grid size-8 place-items-center rounded-full bg-stone-50 text-stone-900 disabled:bg-stone-800 disabled:text-stone-500"
              >
                <ArrowUp weight="bold" className="size-4" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// Three bars that move while the school is speaking.
function Wave() {
  return (
    <span className="flex h-3.5 items-end gap-0.5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-0.5 origin-bottom animate-pulse rounded-full bg-voice"
          style={{ height: "100%", animationDelay: `${delay}ms`, animationDuration: "700ms" }}
        />
      ))}
    </span>
  );
}

function RoundButton({ label, className, children, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        aria-label={label}
        className={cn("grid size-16 place-items-center rounded-full text-white transition-transform active:scale-95", className)}
        {...props}
      >
        {children}
      </button>
      <span className="text-xs text-stone-400">{label}</span>
    </div>
  );
}
