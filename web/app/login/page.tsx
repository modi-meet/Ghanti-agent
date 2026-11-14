"use client";

import { ArrowRight, BellRinging, ChalkboardTeacher, PhoneCall, Translate } from "@phosphor-icons/react";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { Person, Tag } from "@/components/bits";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { fetcher, LANGUAGES, type Me } from "@/lib/api";
import { useLogin } from "@/lib/session";

const POINTS = [
  { icon: ChalkboardTeacher, text: "The teacher says what happened in class. Homework, absences, notes and fees file themselves." },
  { icon: PhoneCall, text: "Parents get a daily message and a weekly call, and can ask anything about their child." },
  { icon: Translate, text: "Everyone speaks their own language. Hindi, Gujarati, English, or a mix." },
];

export default function Login() {
  const { data: accounts } = useSWR<Me[]>("/auth/accounts", fetcher);
  const [pending, setPending] = useState<number | null>(null);
  const login = useLogin();

  async function enter(account: Me) {
    setPending(account.id);
    try {
      await login(account);
    } catch (e) {
      toast.error((e as Error).message);
      setPending(null);
    }
  }

  const group = (role: Me["role"], label: string) => (
    <div>
      <div className="mb-2 text-xs font-medium text-muted-foreground">{label}</div>
      <ItemGroup className="gap-2">
        {!accounts && <Skeleton className="h-[58px] rounded-xl" />}
        {accounts
          ?.filter((a) => a.role === role)
          .map((a) => (
            <Item key={a.id} variant="outline" asChild className="flex-nowrap rounded-xl bg-card">
              <button onClick={() => enter(a)} disabled={pending !== null} className="text-left disabled:opacity-60">
                <ItemMedia>
                  <Person name={a.name} size="lg" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{a.name}</ItemTitle>
                  <ItemDescription>{a.role === "teacher" ? "Class teacher, 8B" : `Parent of ${a.child}`}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  {a.role === "parent" && <Tag>{LANGUAGES[a.language] ?? a.language}</Tag>}
                  {pending === a.id ? <Spinner /> : <ArrowRight className="size-4 text-muted-foreground" />}
                </ItemActions>
              </button>
            </Item>
          ))}
      </ItemGroup>
    </div>
  );

  return (
    <main className="mx-auto grid min-h-dvh max-w-5xl items-center gap-12 px-6 py-12 lg:grid-cols-2">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-voice text-voice-foreground">
            <BellRinging weight="fill" className="size-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Ghanti</span>
        </div>
        <h1 className="mt-10 text-4xl leading-[1.1] font-semibold tracking-tight text-balance">
          The school that calls you back, in your language.
        </h1>
        <ul className="mt-8 space-y-4">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
              <Icon weight="duotone" className="mt-0.5 size-5 shrink-0 text-foreground" />
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-3xl border bg-background p-6 sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight">Pick a side to try it</h2>
        <p className="mt-1 text-sm text-muted-foreground">No password. Every student and parent here is made up.</p>
        <div className="mt-6 space-y-6">
          {group("teacher", "Teacher")}
          {group("parent", "Parents")}
        </div>
        <p className="mt-6 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
          This website stands in for the phone call a parent would get. Speech by Gnani Prisma and Timbre.
        </p>
      </div>
    </main>
  );
}
