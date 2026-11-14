"use client";

import { BookOpenText, Trash } from "@phosphor-icons/react";
import useSWR from "swr";

import { Nothing, PageHeader, Section, Tag } from "@/components/bits";
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
      {data?.length === 0 && (
        <Nothing icon={<BookOpenText />} title="No homework yet">
          Tell Ghanti what you gave today and it shows up here.
        </Nothing>
      )}
      {days.map((d) => {
        const items = data!.filter((h) => h.assigned_date === d);
        return (
          <Section
            key={d}
            flush
            title={day(d, { weekday: "long", day: "numeric", month: "long" })}
            action={
              <span className="text-xs text-muted-foreground">
                {items.length} {items.length === 1 ? "subject" : "subjects"}
              </span>
            }
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-40 pl-5">Subject</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead className="w-32">Due</TableHead>
                  <TableHead className="w-12 pr-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((h) => (
                  <TableRow key={h.id} className="group">
                    <TableCell className="pl-5">
                      <Tag dot={h.subject}>{h.subject}</Tag>
                    </TableCell>
                    <TableCell className="py-3 font-medium whitespace-normal">{h.task}</TableCell>
                    <TableCell className="text-muted-foreground">{day(h.due_date)}</TableCell>
                    <TableCell className="pr-3">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete"
                        className="text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => remove(h.id)}
                      >
                        <Trash />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        );
      })}
    </div>
  );
}
