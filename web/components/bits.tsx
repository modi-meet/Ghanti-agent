"use client";

import { SpeakerHigh, Stop } from "@phosphor-icons/react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { initials } from "@/lib/format";
import { play, stop, usePlaying } from "@/lib/player";
import { cn } from "@/lib/utils";

// Thin wrappers over shadcn/ui, so every screen is built from the same few pieces.

export function PageHeader({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

// A shadcn Card with a ruled header. `flush` lets tables and lists run edge to
// edge, so there is never a box inside a box.
export function Section({
  title,
  description,
  action,
  flush,
  className,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("gap-0 rounded-2xl py-0", className)}>
      {title && (
        <CardHeader className="items-center border-b px-5 py-3.5">
          <CardTitle className="text-[15px] font-semibold tracking-tight">{title}</CardTitle>
          {description && <CardDescription className="text-xs">{description}</CardDescription>}
          {action && <CardAction className="self-center">{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent className={flush ? "px-0" : "px-5 py-4"}>{children}</CardContent>
    </Card>
  );
}

const AVATAR_TINTS = [
  "bg-amber-100 text-amber-900",
  "bg-sky-100 text-sky-900",
  "bg-emerald-100 text-emerald-900",
  "bg-rose-100 text-rose-900",
  "bg-violet-100 text-violet-900",
  "bg-teal-100 text-teal-900",
  "bg-orange-100 text-orange-900",
];
const DOT_COLORS = ["bg-sky-500", "bg-emerald-500", "bg-violet-500", "bg-rose-500", "bg-amber-500", "bg-teal-500"];

// The usual subjects get a fixed colour. Anything else falls back to a hash.
const SUBJECT_DOT: Record<string, string> = {
  Maths: "bg-sky-500",
  Science: "bg-emerald-500",
  Physics: "bg-violet-500",
  Chemistry: "bg-rose-500",
  Biology: "bg-teal-500",
  English: "bg-amber-500",
  Hindi: "bg-orange-500",
  Gujarati: "bg-fuchsia-500",
};

// Same name, same colour, every time.
const pick = (list: string[], key: string) => list[[...key].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % list.length];

export function Person({ name, size = "default" }: { name: string; size?: "sm" | "default" | "lg" }) {
  return (
    <Avatar size={size}>
      <AvatarFallback className={cn("font-semibold", size === "default" && "text-xs", pick(AVATAR_TINTS, name))}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

// A subject label: a coloured dot, then the name.
export function Tag({ children, dot }: { children: React.ReactNode; dot?: string }) {
  return (
    <Badge variant="outline" className="rounded-md bg-background font-medium">
      {dot && <span className={cn("size-1.5 rounded-full", SUBJECT_DOT[dot] ?? pick(DOT_COLORS, dot))} />}
      {children}
    </Badge>
  );
}

const TONE_DOT = { neutral: "bg-stone-400", good: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-red-500" };
export type Tone = keyof typeof TONE_DOT;

// Status as a dot and a word, like "● Overdue".
export function Status({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <Badge variant="outline" className="rounded-md bg-background font-medium">
      <span className={cn("size-1.5 rounded-full", TONE_DOT[tone])} />
      {children}
    </Badge>
  );
}

// Big number, small muted unit.
export function Stat({ value, unit, label }: { value: React.ReactNode; unit?: string; label: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 tabular-nums">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {unit && <span className="ml-1 text-xs text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

export type Mark = "present" | "absent" | "late";
export const MARK_COLOR: Record<Mark, string> = { present: "bg-emerald-500/25", absent: "bg-red-500", late: "bg-amber-400" };

// The last few school days as a row of bars: the quick look before the exact table.
export function WeekBars({ week }: { week: { date: string; mark: Mark }[] }) {
  return (
    <span className="inline-flex gap-1" title={week.map((d) => `${d.date.slice(8)}: ${d.mark}`).join("  ")}>
      {week.map((d) => (
        <span key={d.date} className={cn("h-5 w-1.5 rounded-full", MARK_COLOR[d.mark])} />
      ))}
    </span>
  );
}

export function ListenButton({ url, label = "Listen" }: { url: string; label?: string }) {
  const playing = usePlaying() === url;
  return (
    <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => (playing ? stop() : play(url))}>
      {playing ? <Stop weight="fill" /> : <SpeakerHigh weight="fill" />}
      {playing ? "Stop" : label}
    </Button>
  );
}

export function Nothing({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <Empty className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {children && <EmptyDescription>{children}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  );
}
