"use client";

import useSWR from "swr";

import { type Mark, PageHeader, Person, Section } from "@/components/bits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, fetcher } from "@/lib/api";
import { day } from "@/lib/format";
import { cn } from "@/lib/utils";

type Grid = { days: string[]; today: string; students: { id: number; name: string; roll_no: number; marks: Mark[] }[] };

const NEXT: Record<Mark, Mark> = { present: "absent", absent: "late", late: "present" };
const CELL: Record<Mark, { letter: string; look: string }> = {
  present: { letter: "", look: "hover:bg-muted" },
  absent: { letter: "A", look: "bg-red-500 text-white" },
  late: { letter: "L", look: "bg-amber-400 text-amber-950" },
};
const PRESENT_DOT = "size-1.5 rounded-full bg-emerald-500/60";

export default function AttendancePage() {
  const { data, mutate } = useSWR<Grid>("/teacher/attendance", fetcher);

  // Click a cell to step it: present, absent, late, and round again.
  async function step(student_id: number, date: string, mark: Mark) {
    await api("/teacher/attendance", { method: "PUT", json: { student_id, date, status: NEXT[mark] } });
    mutate();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Attendance" hint="Tell Ghanti who is absent, or click a day to change it." />
      <Section
        flush
        title="Last six school days"
        action={
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className={PRESENT_DOT} />
              Present
            </span>
            <Legend look={CELL.absent.look}>Absent</Legend>
            <Legend look={CELL.late.look}>Late</Legend>
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Student</TableHead>
              {data?.days.map((d) => (
                <TableHead key={d} className={cn("w-16 text-center", d === data.today && "font-semibold text-foreground")}>
                  {d === data.today ? "Today" : day(d, { weekday: "short", day: "numeric" })}
                </TableHead>
              ))}
              <TableHead className="w-24 pr-5 text-right">In school</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.students.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="py-2.5 pl-5">
                  <div className="flex items-center gap-3">
                    <Person name={s.name} />
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">Roll {s.roll_no}</div>
                    </div>
                  </div>
                </TableCell>
                {s.marks.map((mark, i) => (
                  <TableCell key={i} className="text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => step(s.id, data.days[i], mark)}
                          aria-label={`${s.name}, ${day(data.days[i])}: ${mark}`}
                          className={cn(
                            "inline-grid size-7 place-items-center rounded-md text-xs font-semibold transition-colors",
                            CELL[mark].look,
                          )}
                        >
                          {mark === "present" ? <span className={PRESENT_DOT} /> : CELL[mark].letter}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="capitalize">
                        {mark} · {day(data.days[i])}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                ))}
                <TableCell className="pr-5 text-right tabular-nums">
                  <span className="font-medium">{s.marks.filter((m) => m !== "absent").length}</span>
                  <span className="text-xs text-muted-foreground"> / {s.marks.length}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
}

function Legend({ look, children }: { look: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-[3px]", look)} />
      {children}
    </span>
  );
}
