"use client";

import { Eye, EyeSlash, Trash } from "@phosphor-icons/react";
import useSWR from "swr";

import { type Mark, PageHeader, Person, Section, Status, WeekBars } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, fetcher, LANGUAGES } from "@/lib/api";
import { rupees } from "@/lib/format";
import { cn } from "@/lib/utils";

type Note = { id: number; text: string; private: boolean };
type Student = {
  id: number;
  name: string;
  roll_no: number;
  parent: string;
  parent_language: string;
  week: { date: string; mark: Mark }[];
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
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Students"
        hint="Your notes are what Ghanti draws on when a parent asks how their child is doing."
      />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {data?.map((s) => {
          const absent = s.week.filter((d) => d.mark === "absent").length;
          return (
            <Section key={s.id} flush>
              <div className="flex items-center gap-3 px-5 py-4">
                <Person name={s.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold tracking-tight">{s.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    Roll {s.roll_no} · {s.parent} · {LANGUAGES[s.parent_language] ?? s.parent_language}
                  </div>
                </div>
                <WeekBars week={s.week} />
              </div>

              <div className="flex flex-wrap gap-1.5 border-t px-5 py-3">
                <Status tone={absent >= 3 ? "bad" : absent ? "warn" : "good"}>
                  {absent ? `${absent} absent this week` : "Full attendance"}
                </Status>
                <Status tone={s.fee_balance > 0 ? "warn" : "good"}>
                  {s.fee_balance > 0 ? `${rupees(s.fee_balance)} due` : "Fees paid"}
                </Status>
              </div>

              <ul className="divide-y border-t">
                {s.notes.length === 0 && <li className="px-5 py-3 text-sm text-muted-foreground">No notes yet.</li>}
                {s.notes.map((n) => (
                  <li key={n.id} className="group flex items-start gap-2 py-3 pr-3 pl-5">
                    <p className={cn("flex-1 text-sm leading-relaxed", n.private && "text-muted-foreground")}>{n.text}</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon-xs" className="text-muted-foreground" onClick={() => setPrivate(n)}>
                          {n.private ? <EyeSlash weight="fill" /> : <Eye />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {n.private ? "Private. Click to let parents hear it." : "Parents can hear this. Click to make it private."}
                      </TooltipContent>
                    </Tooltip>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Delete note"
                      className="text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => remove(n)}
                    >
                      <Trash />
                    </Button>
                  </li>
                ))}
              </ul>
            </Section>
          );
        })}
      </div>
    </div>
  );
}
