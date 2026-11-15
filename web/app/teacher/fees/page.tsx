"use client";

import { Plus } from "@phosphor-icons/react";
import useSWR from "swr";

import { AddSheet, Field, Select } from "@/components/add-sheet";
import { PageHeader, Person, Section, Stat, Status } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, fetcher } from "@/lib/api";
import { day, rupees } from "@/lib/format";
import { cn } from "@/lib/utils";

type Fee = {
  id: number;
  student: string;
  title: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  due_date: string;
  status: "paid" | "due" | "overdue";
};

const TONE = { paid: "good", due: "warn", overdue: "bad" } as const;

export default function FeesPage() {
  const { data } = useSWR<Fee[]>("/teacher/fees", fetcher);
  const { data: students } = useSWR<{ id: number; name: string }[]>("/teacher/students", fetcher);
  const total = (key: "amount_paid" | "balance") => data?.reduce((n, f) => n + f[key], 0) ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Fees" hint="Tell Ghanti about a payment or a new fee, or put it in here.">
        <AddSheet
          title="Add a fee"
          hint="A new amount for one student to pay."
          button={
            <Button size="sm">
              <Plus weight="bold" /> Add fee
            </Button>
          }
          onSave={(v) =>
            api("/teacher/fees", {
              method: "POST",
              json: { student_id: Number(v.student_id), title: v.title, amount: Number(v.amount), due_date: v.due_date || null },
            })
          }
        >
          <Field label="Student">
            <Select name="student_id" required>
              {students?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="What it is for">
            <Input name="title" required maxLength={120} placeholder="Science fair trip" />
          </Field>
          <Field label="Amount in rupees">
            <Input name="amount" type="number" inputMode="numeric" required min={1} step={1} placeholder="800" />
          </Field>
          <Field label="Due" hint="Leave empty for a week from today.">
            <Input name="due_date" type="date" />
          </Field>
        </AddSheet>
      </PageHeader>

      <Section flush>
        <div className="grid grid-cols-3 divide-x">
          <div className="px-5 py-4">
            <Stat value={rupees(total("amount_paid"))} label="Collected" />
          </div>
          <div className="px-5 py-4">
            <Stat value={rupees(total("balance"))} label="Still to come" />
          </div>
          <div className="px-5 py-4">
            <Stat value={data?.filter((f) => f.status === "overdue").length ?? "–"} unit="families" label="Overdue" />
          </div>
        </div>
      </Section>

      <Section flush title="This term">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Student</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead className="w-52">Paid</TableHead>
              <TableHead className="w-24">Due</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-36 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="py-2.5 pl-5">
                  <div className="flex items-center gap-3">
                    <Person name={f.student} />
                    <span className="font-medium">{f.student}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{f.title}</TableCell>
                <TableCell>
                  <div className="mb-1.5 text-xs tabular-nums">
                    <span className="font-medium">{rupees(f.amount_paid)}</span>
                    <span className="text-muted-foreground"> of {rupees(f.amount_due)}</span>
                  </div>
                  <Progress
                    value={(f.amount_paid / f.amount_due) * 100}
                    className={cn(
                      "h-1.5",
                      f.status === "paid" ? "*:data-[slot=progress-indicator]:bg-emerald-500" : "*:data-[slot=progress-indicator]:bg-amber-500",
                    )}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {day(f.due_date, { day: "numeric", month: "short" })}
                </TableCell>
                <TableCell className="capitalize">
                  <Status tone={TONE[f.status]}>{f.status}</Status>
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {f.balance > 0 && (
                    <AddSheet
                      title="Record a payment"
                      hint={`${f.student}, ${f.title}. ${rupees(f.balance)} is pending.`}
                      save="Record payment"
                      button={
                        <Button variant="outline" size="xs">
                          <Plus weight="bold" /> Payment
                        </Button>
                      }
                      onSave={(v) => api(`/teacher/fees/${f.id}/pay`, { method: "POST", json: { amount: Number(v.amount) } })}
                    >
                      <Field label="Amount received, in rupees">
                        <Input name="amount" type="number" inputMode="numeric" required min={1} max={f.balance} step={1} defaultValue={f.balance} />
                      </Field>
                    </AddSheet>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
}
