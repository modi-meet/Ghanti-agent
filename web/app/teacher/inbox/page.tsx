"use client";

import { CornerDownRight, PhoneCall } from "lucide-react";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";

import { Chip, Empty, PageHeader, Panel } from "@/components/bits";
import { Composer, type Said } from "@/components/composer";
import { fetcher, say } from "@/lib/api";
import { day, time } from "@/lib/format";

type Item = {
  id: number;
  kind: "question" | "summary";
  student: string;
  parent: string;
  text: string;
  original: string;
  status: "open" | "answered" | "read";
  reply: string;
  created_at: string;
};

export default function InboxPage() {
  const { data, mutate } = useSWR<Item[]>("/teacher/inbox", fetcher, { refreshInterval: 15000 });
  const { mutate: mutateAll } = useSWRConfig();
  const [busy, setBusy] = useState<number | null>(null);

  async function reply(item: Item, said: Said) {
    setBusy(item.id);
    try {
      await say(`/teacher/inbox/${item.id}/reply`, said);
      toast.success(`${item.parent} will hear your reply in their language.`);
      await mutate();
      mutateAll("/teacher/overview");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Inbox" hint="What parents asked that the records couldn't answer, and a line on every call." />
      {data?.length === 0 && <Empty>Nothing from parents yet. It shows up here after they talk to Ghanti.</Empty>}
      {data?.map((item) => (
        <Panel key={item.id}>
          <div className="flex items-center gap-2">
            <div className="font-semibold tracking-tight">{item.parent}</div>
            <span className="text-xs text-muted-foreground">parent of {item.student}</span>
            <div className="ml-auto flex items-center gap-2">
              {item.kind === "summary" ? (
                <Chip>
                  <PhoneCall className="mr-1 size-3" /> Call summary
                </Chip>
              ) : (
                <Chip tone={item.status === "open" ? "warn" : "good"}>{item.status === "open" ? "Needs a reply" : "Answered"}</Chip>
              )}
              <span className="text-xs text-muted-foreground tabular-nums">
                {day(item.created_at, { day: "numeric", month: "short" })}, {time(item.created_at)}
              </span>
            </div>
          </div>
          <p className="mt-3 text-sm">{item.text}</p>
          {item.original && <p className="mt-1 text-xs text-muted-foreground">In their words: “{item.original}”</p>}
          {item.reply && (
            <p className="mt-3 flex gap-2 rounded-xl border bg-muted/50 p-2.5 text-sm">
              <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              {item.reply}
            </p>
          )}
          {item.kind === "question" && item.status === "open" && (
            <div className="mt-4">
              <Composer busy={busy === item.id} placeholder="Hold the mic to answer, or type" onSend={(s) => reply(item, s)} />
            </div>
          )}
        </Panel>
      ))}
    </div>
  );
}
