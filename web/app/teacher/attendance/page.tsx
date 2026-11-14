"use client";

import useSWR from "swr";

import { PageHeader, Panel } from "@/components/bits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, fetcher } from "@/lib/api";
import { day } from "@/lib/format";
import { cn } from "@/lib/utils";

type Mark = "present" | "absent" | "late";
type Grid = { days: string[]; today: string; students: { id: number; name: string; roll_no: number; marks: Mark[] }[] };

const NEXT: Record<Mark, Mark> = { present: "absent", absent: "late", late: "present" };
const LOOK: Record<Mark, string> = {
  present: "border-emerald-200 bg-emerald-50 text-emerald-700",
  absent: "border-red-200 bg-red-50 text-red-700",
  late: "border-amber-200 bg-amber-50 text-amber-800",
};

export default function AttendancePage() {
  const { data, mutate } = useSWR<Grid>("/teacher/attendance", fetcher);

  // Click a cell to step it: present, absent, late, and round again.
  async function step(student_id: number, date: string, mark: Mark) {
    await api("/teacher/attendance", { method: "PUT", json: { student_id, date, status: NEXT[mark] } });
    mutate();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Attendance" hint="The last six school days. Click a cell to change it." />
      <Panel>
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Student</TableHead>
                {data?.days.map((d) => (
                  <TableHead key={d} className={cn("w-20 text-center", d === data.today && "text-foreground")}>
                    {day(d, { weekday: "short", day: "numeric" })}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-muted-foreground tabular-nums">{s.roll_no}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  {s.marks.map((mark, i) => (
                    <TableCell key={i} className="text-center">
                      <button
                        onClick={() => step(s.id, data.days[i], mark)}
                        title={`${s.name}, ${day(data.days[i])}: ${mark}`}
                        className={cn("w-16 rounded-md border px-2 py-0.5 text-xs font-medium capitalize", LOOK[mark])}
                      >
                        {mark}
                      </button>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );
}
