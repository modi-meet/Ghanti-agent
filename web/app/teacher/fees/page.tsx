"use client";

import useSWR from "swr";

import { Chip, PageHeader, Panel, Stat } from "@/components/bits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetcher } from "@/lib/api";
import { day, rupees } from "@/lib/format";

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
  const total = (key: "amount_paid" | "balance") => data?.reduce((n, f) => n + f[key], 0) ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Fees" hint="Record a payment by telling Ghanti. It asks you to confirm before saving." />
      <Panel>
        <div className="flex gap-10">
          <Stat value={rupees(total("amount_paid"))} label="Collected" />
          <Stat value={rupees(total("balance"))} label="Still to come" />
          <Stat value={data?.filter((f) => f.status === "overdue").length ?? "–"} label="Overdue" />
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.student}</TableCell>
                  <TableCell className="text-muted-foreground">{f.title}</TableCell>
                  <TableCell className="text-right tabular-nums">{rupees(f.amount_paid)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{rupees(f.balance)}</TableCell>
                  <TableCell className="text-muted-foreground">{day(f.due_date, { day: "numeric", month: "short" })}</TableCell>
                  <TableCell>
                    <Chip tone={TONE[f.status]}>{f.status}</Chip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );
}
