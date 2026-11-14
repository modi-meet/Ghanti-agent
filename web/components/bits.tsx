"use client";

import { Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { play, stop, usePlaying } from "@/lib/player";
import { cn } from "@/lib/utils";

// Small pieces used on more than one page.

export function PageHeader({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border bg-card p-5", className)} {...props} />;
}

const TONES = {
  neutral: "border-border bg-muted text-muted-foreground",
  good: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  bad: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
};

export function Chip({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", TONES[tone])}>
      {children}
    </span>
  );
}

// Big number, small muted unit.
export function Stat({ value, unit, label }: { value: React.ReactNode; unit?: string; label: string }) {
  return (
    <div>
      <div className="tabular-nums">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {unit && <span className="ml-0.5 text-xs text-muted-foreground">{unit}</span>}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function PlayButton({ url, label = "Listen" }: { url: string; label?: string }) {
  const playing = usePlaying() === url;
  return (
    <Button variant="outline" size="sm" onClick={() => (playing ? stop() : play(url))}>
      {playing ? <Pause /> : <Play />}
      {playing ? "Stop" : label}
    </Button>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
