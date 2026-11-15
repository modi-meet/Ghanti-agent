"use client";

import {
  ArrowRight,
  BellRinging,
  BookOpenText,
  CalendarCheck,
  CaretDown,
  CaretRight,
  CurrencyInr,
  NotePencil,
  Question,
  Wrench,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";

import { ActionList } from "@/components/action-card";
import { ListenButton, PageHeader, Person, Section, Tag } from "@/components/bits";
import { MicButton } from "@/components/mic-button";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { fetcher, say, type Exchange, type Turn } from "@/lib/api";
import { rupees } from "@/lib/format";
import { play } from "@/lib/player";
import { useMe } from "@/lib/session";
import { cn } from "@/lib/utils";

type Overview = {
  students: number;
  absent: string[];
  late: string[];
  homework: { subject: string; task: string }[];
  fees_pending: { count: number; amount: number };
  inbox_open: number;
};

const TRY = [
  { icon: BookOpenText, line: "Class 8B physics homework is lesson 3 examples 1 to 5, and in chemistry read lesson 2 fully for tomorrow" },
  { icon: CalendarCheck, line: "Aarav and Diya are absent today" },
  { icon: NotePencil, line: "Note for Meera: she topped the science quiz this week" },
  { icon: CurrencyInr, line: "Kabir's parents paid 5000 rupees towards the term fee" },
  { icon: Question, line: "Who has been absent the most this week?" },
];

type Said = { audio?: Blob; text?: string };

export default function Chat() {
  const me = useMe("teacher");
  const { mutate } = useSWRConfig();
  const { data: turns, mutate: setTurns } = useSWR<Turn[]>("/teacher/chat", fetcher, { revalidateOnFocus: false });
  const { data: overview } = useSWR<Overview>("/teacher/overview", fetcher);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [turns, busy]);

  // The dashboard tabs read the same data, so nudge them after anything changes.
  const refreshDashboard = () =>
    mutate((key) => typeof key === "string" && key.startsWith("/teacher/") && key !== "/teacher/chat");

  async function send(said: Said) {
    setBusy(true);
    try {
      const exchange = await say<Exchange>("/teacher/chat", said);
      await setTurns((old) => [...(old ?? []), exchange.user, exchange.assistant], { revalidate: false });
      refreshDashboard();
      // Spoke to it, so it speaks back.
      if (said.audio && exchange.assistant.audio_url) play(exchange.assistant.audio_url);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="flex min-h-[calc(100dvh-9.5rem)] flex-col">
        <PageHeader title="Chat" hint="Say what happened in class. Ghanti files it, and parents see the same thing." />

        <div className="mt-8 flex-1 space-y-6">
          {turns?.length === 0 && (
            <ItemGroup className="gap-2">
              <div className="mb-1 text-xs font-medium text-muted-foreground">Try saying</div>
              {TRY.map(({ icon: Icon, line }) => (
                <Item key={line} variant="outline" size="sm" className="flex-nowrap bg-card">
                  <ItemMedia variant="icon">
                    <Icon weight="duotone" className="size-5" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="line-clamp-none font-normal">“{line}”</ItemTitle>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          )}
          {turns?.map((turn) => <Message key={turn.id} turn={turn} onChange={refreshDashboard} />)}
          {busy && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Mark />
              <Spinner /> Working on it
            </div>
          )}
          <div ref={bottom} />
        </div>

        {/* Voice only. Anything typed goes through the + Add buttons on each tab. */}
        <div className="sticky bottom-0 -mx-2 mt-6 flex flex-col items-center gap-2 bg-background px-2 pt-4 pb-1 text-center">
          <MicButton large busy={busy} onClip={(audio) => send({ audio })} onRecording={setRecording} />
          <div className="text-sm font-medium">
            {recording ? "Listening. Let go to send." : busy ? "Working on it" : "Hold to talk"}
          </div>
          <p className="text-xs text-muted-foreground">
            Hindi and English mixed is fine. You can also focus the mic and hold <Kbd>Space</Kbd>.
          </p>
          {me?.speech_mode === "mock" && (
            // Mock speech hears nothing, so local runs send a sample line instead.
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="xs" className="text-muted-foreground" disabled={busy}>
                  Mock speech is on. Send a sample line <CaretDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-96 max-w-[90vw]">
                {TRY.map(({ line }) => (
                  <DropdownMenuItem key={line} className="whitespace-normal" onClick={() => send({ text: line })}>
                    {line}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <aside className="hidden lg:block">
        <Section title="Today" className="sticky top-8">
          <dl className="space-y-5 text-sm">
            <Glance label="Homework given" empty="Nothing yet" has={!!overview?.homework.length}>
              <div className="flex flex-wrap gap-1.5">
                {overview?.homework.map((h) => (
                  <Tag key={h.subject + h.task} dot={h.subject}>
                    {h.subject}
                  </Tag>
                ))}
              </div>
            </Glance>
            <Glance label="Absent" empty="Everyone is in" has={!!overview?.absent.length}>
              <div className="space-y-1.5">
                {overview?.absent.map((name) => (
                  <div key={name} className="flex items-center gap-2">
                    <Person name={name} size="sm" /> {name}
                  </div>
                ))}
              </div>
            </Glance>
            <Glance label="Fees pending" empty="All paid" has={!!overview?.fees_pending.count}>
              <span className="font-medium tabular-nums">{rupees(overview?.fees_pending.amount ?? 0)}</span>
              <span className="text-muted-foreground"> from {overview?.fees_pending.count} families</span>
            </Glance>
            <Glance label="From parents" empty="Nothing waiting" has={!!overview?.inbox_open}>
              <Link href="/teacher/inbox" className="inline-flex items-center gap-1 font-medium hover:underline">
                {overview?.inbox_open} waiting for a reply <ArrowRight className="size-3.5" />
              </Link>
            </Glance>
          </dl>
        </Section>
      </aside>
    </div>
  );
}

function Glance({ label, empty, has, children }: { label: string; empty: string; has: boolean; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1.5">{has ? children : <span className="text-muted-foreground">{empty}</span>}</dd>
    </div>
  );
}

// Ghanti's mark, next to everything it says.
function Mark() {
  return (
    <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-voice text-voice-foreground">
      <BellRinging weight="fill" className="size-4" />
    </div>
  );
}

function Message({ turn, onChange }: { turn: Turn; onChange: () => void }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-sm leading-relaxed">{turn.text}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <Mark />
      <div className="min-w-0 flex-1 space-y-3">
        <p className="pt-1 text-sm leading-relaxed">{turn.text}</p>
        {turn.actions.length > 0 && <ActionList actions={turn.actions} onChange={onChange} />}
        <div className="-ml-2 flex flex-wrap items-start gap-x-1">
          {turn.audio_url && <ListenButton url={turn.audio_url} />}
          {turn.trace.length > 0 && <Trace turn={turn} />}
        </div>
      </div>
    </div>
  );
}

// What the agent actually called to get here.
function Trace({ turn }: { turn: Turn }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0 text-xs text-muted-foreground">
      <button onClick={() => setOpen(!open)} className="flex h-6 items-center gap-1 rounded-md px-2 hover:bg-muted hover:text-foreground">
        <Wrench weight="fill" className="size-3" />
        {turn.trace.length} tool {turn.trace.length === 1 ? "call" : "calls"}
        <CaretRight className={cn("size-3 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <ol className="mt-1.5 ml-2 space-y-1 border-l pl-3 font-mono">
          {turn.trace.map((t, i) => (
            <li key={i} className={cn("break-all", !t.ok && "text-red-600")}>
              <span className="text-foreground">{t.name}</span>({JSON.stringify(t.args)}){" "}
              <span className="tabular-nums opacity-60">{t.ms}ms</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
