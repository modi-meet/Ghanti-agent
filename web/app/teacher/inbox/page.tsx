"use client";

import { ArrowBendDownRight, Tray } from "@phosphor-icons/react";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";

import { Nothing, PageHeader, Person, Section, Status } from "@/components/bits";
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
      {data?.length === 0 && (
        <Nothing icon={<Tray />} title="Nothing from parents yet">
          Questions and call summaries land here after parents talk to Ghanti.
        </Nothing>
      )}
      {data?.map((item) => (
        <Section key={item.id} flush>
          <div className="flex items-center gap-3 px-5 py-4">
            <Person name={item.parent} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold tracking-tight">{item.parent}</div>
              <div className="text-xs text-muted-foreground">
                Parent of {item.student} · {day(item.created_at, { day: "numeric", month: "short" })}, {time(item.created_at)}
              </div>
            </div>
            {item.kind === "summary" ? (
              <Status>Call summary</Status>
            ) : (
              <Status tone={item.status === "open" ? "warn" : "good"}>
                {item.status === "open" ? "Needs a reply" : "Answered"}
              </Status>
            )}
          </div>

          <div className="space-y-3 border-t px-5 py-4">
            <p className="text-sm leading-relaxed">{item.text}</p>
            {item.original && (
              <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground">{item.original}</blockquote>
            )}
            {item.reply && (
              <p className="flex gap-2 text-sm">
                <ArrowBendDownRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  <span className="text-muted-foreground">You said: </span>
                  {item.reply}
                </span>
              </p>
            )}
          </div>

          {item.kind === "question" && item.status === "open" && (
            <div className="border-t bg-muted/40 p-3">
              <Composer
                busy={busy === item.id}
                placeholder={`Answer ${item.parent.split(" ")[0]}, by voice or text`}
                onSend={(s) => reply(item, s)}
              />
            </div>
          )}
        </Section>
      ))}
    </div>
  );
}
