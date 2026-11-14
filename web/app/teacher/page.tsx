"use client";

import { ChevronRight, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";

import { ActionCard } from "@/components/action-card";
import { PageHeader, Panel, PlayButton, Stat } from "@/components/bits";
import { Composer, type Said } from "@/components/composer";
import { fetcher, say, type Exchange, type Turn } from "@/lib/api";
import { play } from "@/lib/player";
import { cn } from "@/lib/utils";

type Overview = {
  students: number;
  absent_today: number;
  homework_today: number;
  fees_pending: number;
  inbox_open: number;
};

const TRY = [
  "Class 8B physics homework is lesson 3 examples 1 to 5, and in chemistry read lesson 2 fully for tomorrow",
  "Aarav and Diya are absent today",
  "Note for Meera: she topped the science quiz this week",
  "Kabir's parents paid 5000 rupees towards the term fee",
  "Who has been absent the most this week?",
];

export default function Chat() {
  const { mutate } = useSWRConfig();
  const { data: turns, mutate: setTurns } = useSWR<Turn[]>("/teacher/chat", fetcher, { revalidateOnFocus: false });
  const { data: overview } = useSWR<Overview>("/teacher/overview", fetcher);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [turns, busy]);

  // The dashboard tabs read the same data, so nudge them after anything changes.
  const refreshDashboard = () => mutate((key) => typeof key === "string" && key.startsWith("/teacher/") && key !== "/teacher/chat");

  async function send(said: Said) {
    setBusy(true);
    try {
      const exchange = await say<Exchange>("/teacher/chat", said);
      await setTurns((old) => [...(old ?? []), exchange.user, exchange.assistant], { revalidate: false });
      refreshDashboard();
      // Spoke to it, so it speaks back. Typed, so it stays quiet.
      if (said.audio && exchange.assistant.audio_url) play(exchange.assistant.audio_url);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_260px]">
      <div className="flex min-h-[calc(100dvh-11rem)] flex-col">
        <PageHeader title="Chat" hint="Say what happened in class. Ghanti files it, and parents see the same thing." />

        <div className="mt-6 flex-1 space-y-5">
          {turns?.length === 0 && (
            <Panel>
              <div className="text-sm font-medium">Hold the mic and try one of these</div>
              <div className="mt-3 flex flex-col items-start gap-2">
                {TRY.map((line) => (
                  <button
                    key={line}
                    disabled={busy}
                    onClick={() => send({ text: line })}
                    className="rounded-lg border px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    “{line}”
                  </button>
                ))}
              </div>
            </Panel>
          )}
          {turns?.map((turn) => <Bubble key={turn.id} turn={turn} onChange={refreshDashboard} />)}
          {busy && <div className="text-sm text-muted-foreground">Ghanti is working on it…</div>}
          <div ref={bottom} />
        </div>

        <div className="sticky bottom-0 -mx-1 mt-4 bg-background px-1 pt-2 pb-1">
          <Composer onSend={send} busy={busy} placeholder="Hold the mic to talk, or type here" />
        </div>
      </div>

      <aside className="hidden lg:block">
        <Panel className="sticky top-6">
          <div className="text-lg font-semibold tracking-tight">Today</div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
            <Stat value={overview?.homework_today ?? "–"} label="Homework given" />
            <Stat value={overview?.absent_today ?? "–"} unit={`/ ${overview?.students ?? "–"}`} label="Absent" />
            <Stat value={overview?.fees_pending ?? "–"} label="Fees pending" />
            <Stat value={overview?.inbox_open ?? "–"} label="From parents" />
          </div>
          <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
            These change as you talk. Open a tab on the left to see or fix the entries.
          </p>
        </Panel>
      </aside>
    </div>
  );
}

function Bubble({ turn, onChange }: { turn: Turn; onChange: () => void }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
          {turn.text}
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-[85%] space-y-2">
      <div className="rounded-2xl rounded-bl-md border bg-card px-3.5 py-2 text-sm">{turn.text}</div>
      {turn.actions.map((a) => (
        <ActionCard key={a.id} action={a} onChange={onChange} />
      ))}
      <div className="flex items-center gap-2">
        {turn.audio_url && <PlayButton url={turn.audio_url} />}
        {turn.trace.length > 0 && <Trace turn={turn} />}
      </div>
    </div>
  );
}

// What the agent actually called to get here.
function Trace({ turn }: { turn: Turn }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-xs text-muted-foreground">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 hover:text-foreground">
        <Wrench className="size-3" />
        {turn.trace.length} tool {turn.trace.length === 1 ? "call" : "calls"}
        <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="mt-1.5 space-y-1 rounded-lg border bg-muted/50 p-2 font-mono">
          {turn.trace.map((t, i) => (
            <div key={i} className={cn("break-all", !t.ok && "text-red-600")}>
              {t.name}({JSON.stringify(t.args)}) <span className="tabular-nums opacity-60">{t.ms}ms</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
