"use client";

import { Trash2 } from "lucide-react";
import useSWR from "swr";

import { Chip, Empty, PageHeader, Panel } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, fetcher } from "@/lib/api";
import { day } from "@/lib/format";

type Homework = { id: number; class: string; subject: string; task: string; assigned_date: string; due_date: string };

export default function HomeworkPage() {
  const { data, mutate } = useSWR<Homework[]>("/teacher/homework", fetcher);

  // One card per day it was given, newest first.
  const days = [...new Set(data?.map((h) => h.assigned_date))];

  async function remove(id: number) {
    await api(`/teacher/homework/${id}`, { method: "DELETE" });
    mutate();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Homework" hint="Added from Chat. Parents hear it in their own language." />
      {data?.length === 0 && <Empty>No homework yet. Tell Ghanti what you gave today.</Empty>}
      {days.map((d) => {
        const items = data!.filter((h) => h.assigned_date === d);
        return (
          <Panel key={d}>
            <div className="flex items-baseline justify-between">
              <div className="text-lg font-semibold tracking-tight">{day(d)}</div>
              <div className="text-xs text-muted-foreground">
                {items.length} {items.length === 1 ? "subject" : "subjects"}
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Subject</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead className="w-28">Due</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>
                        <Chip tone="info">{h.subject}</Chip>
                      </TableCell>
                      <TableCell className="font-medium whitespace-normal">{h.task}</TableCell>
                      <TableCell className="text-muted-foreground">{day(h.due_date)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => remove(h.id)}>
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
