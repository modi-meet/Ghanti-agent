"use client";

import { Eye, EyeOff, Trash2 } from "lucide-react";
import useSWR from "swr";

import { Chip, PageHeader, Panel } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { api, fetcher, LANGUAGES } from "@/lib/api";
import { initials, rupees } from "@/lib/format";

type Note = { id: number; text: string; private: boolean };
type Student = {
  id: number;
  name: string;
  roll_no: number;
  parent: string;
  parent_language: string;
  absent_7d: number;
  fee_balance: number;
  notes: Note[];
};

export default function StudentsPage() {
  const { data, mutate } = useSWR<Student[]>("/teacher/students", fetcher);

  async function setPrivate(note: Note) {
    await api(`/teacher/notes/${note.id}`, { method: "PUT", json: { private: !note.private } });
    mutate();
  }
  async function remove(note: Note) {
    await api(`/teacher/notes/${note.id}`, { method: "DELETE" });
    mutate();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Students"
        hint="Your notes are what Ghanti draws on when a parent asks how their child is doing."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {data?.map((s) => (
          <Panel key={s.id}>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-muted text-sm font-semibold">
                {initials(s.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold tracking-tight">{s.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  Roll {s.roll_no} · {s.parent} · {LANGUAGES[s.parent_language] ?? s.parent_language}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip tone={s.absent_7d >= 3 ? "bad" : s.absent_7d ? "warn" : "good"}>
                {s.absent_7d ? `${s.absent_7d} absent this week` : "Full attendance"}
              </Chip>
              {s.fee_balance > 0 && <Chip tone="warn">{rupees(s.fee_balance)} due</Chip>}
            </div>
            <div className="mt-4 space-y-2">
              {s.notes.length === 0 && <p className="text-xs text-muted-foreground">No notes yet.</p>}
              {s.notes.map((n) => (
                <div key={n.id} className="group flex items-start gap-2 rounded-xl border p-2.5">
                  <p className="flex-1 text-sm">{n.text}</p>
                  {n.private && <Chip>Private</Chip>}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setPrivate(n)}
                    title={n.private ? "Private. Click to let parents hear it." : "Parents can hear this. Click to make it private."}
                  >
                    {n.private ? <EyeOff /> : <Eye />}
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => remove(n)} title="Delete note">
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
