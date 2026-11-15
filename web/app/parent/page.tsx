"use client";

import { ArrowBendDownRight, BookOpenText, CaretRight, ChatsCircle, Phone, PhoneIncoming, SignOut } from "@phosphor-icons/react";
import { useState } from "react";
import useSWR from "swr";

import { CallScreen, type SchoolMessage } from "@/components/call-screen";
import { MARK_COLOR, Nothing, Person, Section, Stat, Status, Tag } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { fetcher, LANGUAGES } from "@/lib/api";
import { day, rupees, time } from "@/lib/format";
import { unlock } from "@/lib/player";
import { useLogout, useMe } from "@/lib/session";
import { cn } from "@/lib/utils";

type Home = {
  child: { name: string; class: string; roll_no: number };
  teacher: string;
  messages: SchoolMessage[];
  homework: { id: number; subject: string; task: string; assigned_date: string; due_date: string }[];
  attendance: { school_days: number; days_present: number; absent_on: string[]; late_on: string[] };
  fees: { fee: string; total: number; paid: number; balance: number; due_on: string; overdue: boolean }[];
};

const ICON = { weekly: PhoneIncoming, homework: BookOpenText, reply: ArrowBendDownRight };

export default function ParentHome() {
  const me = useMe("parent");
  const logout = useLogout();
  const { data, mutate } = useSWR<Home>(me ? "/parent/home" : null, fetcher, { refreshInterval: 20000 });
  // undefined: no call. A null message: the parent rang the school. A message: the school rang them.
  const [call, setCall] = useState<{ message: SchoolMessage | null; ring: boolean; key: number } | undefined>();

  // unlock() runs in the tap itself, so the phone lets the school's voice play later.
  function open(message: SchoolMessage | null, ring = false) {
    if (!ring) unlock();
    setCall({ message, ring, key: Date.now() });
  }

  if (!me || !data) return null;

  const first = data.child.name.split(" ")[0];
  const caller = `${first}'s school · Class ${data.child.class}`;
  const ringing = data.messages.find((m) => m.kind === "weekly" && !m.heard);
  const due = data.fees.filter((f) => f.balance > 0);
  const { attendance } = data;

  if (call) {
    return (
      <CallScreen
        caller={caller}
        message={call.message ?? undefined}
        ring={call.ring}
        callKey={call.key}
        onClose={() => {
          setCall(undefined);
          mutate();
        }}
      />
    );
  }

  // One column on a phone. On a wide screen the school's messages take the
  // left, and the week and homework sit beside them.
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 pt-4 pb-10 lg:max-w-5xl lg:px-8 lg:pt-8">
      <header className="flex items-center gap-3 py-1">
        <Person name={data.child.name} size="lg" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-semibold tracking-tight">{data.child.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            Class {data.child.class} · {data.teacher} · {LANGUAGES[me.language]}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out" className="text-muted-foreground">
          <SignOut />
        </Button>
      </header>

      {ringing && (
        <button
          onClick={() => open(ringing, true)}
          className="flex w-full items-center gap-3.5 rounded-2xl bg-stone-950 p-4 text-left text-stone-50"
        >
          <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-emerald-600">
            <span className="absolute -inset-1 animate-ping rounded-full border-2 border-emerald-500/70" />
            <Phone weight="fill" className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold tracking-tight">The school is calling</span>
            <span className="block text-xs text-stone-400">{ringing.title}</span>
          </span>
          <span className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-sm font-medium">Answer</span>
        </button>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr] lg:gap-6">
      <Section title="This week" flush className="lg:col-start-2 lg:row-start-1">
        <div className="grid grid-cols-2 divide-x">
          <div className="px-5 py-4">
            <Stat value={attendance.days_present} unit={`of ${attendance.school_days} days`} label="In school" />
          </div>
          <div className="px-5 py-4">
            <Stat value={rupees(due.reduce((n, f) => n + f.balance, 0))} label="Fees due" />
          </div>
        </div>
        {(attendance.absent_on.length > 0 || attendance.late_on.length > 0 || due.length > 0) && (
          <ul className="divide-y border-t text-sm">
            {attendance.absent_on.map((d) => (
              <Line key={d} mark="absent" label="Absent" value={d} />
            ))}
            {attendance.late_on.map((d) => (
              <Line key={d} mark="late" label="Late" value={d} />
            ))}
            {due.map((f) => (
              <li key={f.fee} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span>{f.fee}</span>
                <span className="shrink-0">
                  <Status tone={f.overdue ? "bad" : "warn"}>
                    {rupees(f.balance)} by {f.due_on}
                  </Status>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="From the school"
        flush
        className="lg:col-start-1 lg:row-span-2 lg:row-start-1"
        action={
          <Button size="sm" onClick={() => open(null)}>
            <Phone weight="fill" /> Ask the school
          </Button>
        }
      >
        {data.messages.length === 0 ? (
          <Nothing icon={<ChatsCircle />} title="No messages yet">
            You can still ask the school anything.
          </Nothing>
        ) : (
          <ItemGroup className="gap-0 divide-y">
            {data.messages.map((m) => {
              const Icon = ICON[m.kind];
              return (
                <Item key={m.id} asChild size="sm" className="flex-nowrap rounded-none border-0 px-5">
                  <button onClick={() => open(m)} className="text-left">
                    <ItemMedia variant="icon">
                      <Icon weight="duotone" className="size-5" />
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle>
                        {m.title}
                        {!m.heard && <span className="size-1.5 rounded-full bg-voice" />}
                      </ItemTitle>
                      <ItemDescription className="line-clamp-1 lg:line-clamp-2">{m.script}</ItemDescription>
                    </ItemContent>
                    <ItemActions className="text-xs text-muted-foreground tabular-nums">
                      {time(m.created_at)}
                      <CaretRight className="size-3.5" />
                    </ItemActions>
                  </button>
                </Item>
              );
            })}
          </ItemGroup>
        )}
      </Section>

      <Section title="Homework" flush className="lg:col-start-2 lg:row-start-2">
        {data.homework.length === 0 ? (
          <Nothing icon={<BookOpenText />} title="Nothing in the last few days" />
        ) : (
          <ul className="divide-y">
            {data.homework.map((h) => (
              <li key={h.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <Tag dot={h.subject}>{h.subject}</Tag>
                  <span className="text-xs text-muted-foreground">Due {day(h.due_date)}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed font-medium">{h.task}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
      </div>

      <p className="px-4 pt-2 text-center text-xs leading-relaxed text-muted-foreground">
        A demo with made-up data. This page stands in for a real phone call from {data.teacher}&apos;s class.
      </p>
    </div>
  );
}

function Line({ mark, label, value }: { mark: "absent" | "late"; label: string; value: string }) {
  return (
    <li className="flex items-center gap-3 px-5 py-2.5">
      <span className={cn("h-4 w-1 rounded-full", MARK_COLOR[mark])} />
      <span>{label}</span>
      <span className="ml-auto text-muted-foreground">{value}</span>
    </li>
  );
}
