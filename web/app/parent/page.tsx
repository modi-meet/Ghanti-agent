"use client";

import { BellRing, BookOpen, CornerDownRight, LogOut, Phone, PhoneIncoming } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

import { CallScreen, type SchoolMessage } from "@/components/call-screen";
import { Chip, Empty, Panel, Stat } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { fetcher, LANGUAGES } from "@/lib/api";
import { day, rupees, time } from "@/lib/format";
import { unlock } from "@/lib/player";
import { useLogout, useMe } from "@/lib/session";

type Home = {
  child: { name: string; class: string; roll_no: number };
  teacher: string;
  messages: SchoolMessage[];
  homework: { id: number; subject: string; task: string; assigned_date: string; due_date: string }[];
  attendance: { school_days: number; days_present: number; absent_on: string[]; late_on: string[] };
  fees: { fee: string; total: number; paid: number; balance: number; due_on: string; overdue: boolean }[];
};

const ICON = { weekly: PhoneIncoming, homework: BookOpen, reply: CornerDownRight };

export default function ParentHome() {
  const me = useMe("parent");
  const logout = useLogout();
  const { data, mutate } = useSWR<Home>(me ? "/parent/home" : null, fetcher, { refreshInterval: 20000 });
  // undefined: no call. null: the parent rang the school. A message: the school rang them.
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

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-5">
      <header className="flex items-center gap-2.5">
        <div className="grid size-8 place-items-center rounded-lg bg-voice text-voice-foreground">
          <BellRing className="size-4" />
        </div>
        <div className="flex-1 leading-tight">
          <div className="text-sm font-semibold tracking-tight">{me.name}</div>
          <div className="text-xs text-muted-foreground">
            {data.child.name} · Class {data.child.class} · {LANGUAGES[me.language]}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out">
          <LogOut />
        </Button>
      </header>

      {ringing && (
        <button
          onClick={() => open(ringing, true)}
          className="flex w-full items-center gap-3 rounded-2xl bg-neutral-950 p-4 text-left text-neutral-50"
        >
          <div className="relative grid size-11 place-items-center rounded-full bg-emerald-600">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-600/50" />
            <Phone className="relative size-5" />
          </div>
          <div className="flex-1">
            <div className="font-semibold tracking-tight">The school is calling</div>
            <div className="text-xs text-neutral-400">{ringing.title} · tap to answer</div>
          </div>
        </button>
      )}

      <Panel>
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold tracking-tight">From the school</div>
          <Button size="sm" onClick={() => open(null)}>
            <Phone /> Ask the school
          </Button>
        </div>
        <div className="mt-3 divide-y">
          {data.messages.length === 0 && <Empty>No messages yet. You can still ask the school anything.</Empty>}
          {data.messages.map((m) => {
            const Icon = ICON[m.kind];
            return (
              <button
                key={m.id}
                onClick={() => open(m)}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {m.title}
                    {!m.heard && <span className="size-1.5 rounded-full bg-voice" />}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{m.script}</div>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{time(m.created_at)}</span>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel>
        <div className="text-lg font-semibold tracking-tight">This week</div>
        <div className="mt-3 flex gap-8">
          <Stat value={data.attendance.days_present} unit={`/ ${data.attendance.school_days} days`} label="In school" />
          <Stat value={rupees(due.reduce((n, f) => n + f.balance, 0))} label="Fees due" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.attendance.absent_on.map((d) => (
            <Chip key={d} tone="bad">
              Absent {d}
            </Chip>
          ))}
          {data.attendance.late_on.map((d) => (
            <Chip key={d} tone="warn">
              Late {d}
            </Chip>
          ))}
          {due.map((f) => (
            <Chip key={f.fee} tone={f.overdue ? "bad" : "warn"}>
              {f.fee}: {rupees(f.balance)} by {f.due_on}
            </Chip>
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="text-lg font-semibold tracking-tight">Homework</div>
        <div className="mt-3 space-y-2">
          {data.homework.length === 0 && <Empty>Nothing given in the last few days.</Empty>}
          {data.homework.map((h) => (
            <div key={h.id} className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <Chip tone="info">{h.subject}</Chip>
                <span className="text-xs text-muted-foreground">Due {day(h.due_date)}</span>
              </div>
              <p className="mt-2 text-sm font-medium">{h.task}</p>
            </div>
          ))}
        </div>
      </Panel>

      <p className="pb-4 text-center text-xs text-muted-foreground">
        A demo with made-up data. This page stands in for a real phone call from {data.teacher}&apos;s class.
      </p>
    </div>
  );
}
