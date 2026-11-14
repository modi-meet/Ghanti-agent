"use client";

import { ArrowRight, BellRing } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { Chip } from "@/components/bits";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher, LANGUAGES, type Me } from "@/lib/api";
import { initials } from "@/lib/format";
import { useLogin } from "@/lib/session";

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

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="flex items-center gap-2.5">
        <div className="grid size-9 place-items-center rounded-xl bg-voice text-voice-foreground">
          <BellRing className="size-4.5" />
        </div>
        <span className="text-lg font-semibold tracking-tight">Ghanti</span>
      </div>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">The school that calls you back.</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Teachers run the class by talking. Parents hear about their child in their own language and can ask
        anything. Pick a side to try it.
      </p>

      <div className="mt-8 space-y-2">
        {!accounts && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        {accounts?.map((a) => (
          <button
            key={a.id}
            onClick={() => enter(a)}
            disabled={pending !== null}
            className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors hover:bg-accent disabled:opacity-60"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-muted text-sm font-semibold">
              {initials(a.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{a.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {a.role === "teacher" ? "Class teacher, 8B" : `Parent of ${a.child}`}
              </div>
            </div>
            {a.role === "parent" && <Chip>{LANGUAGES[a.language] ?? a.language}</Chip>}
            <ArrowRight className="size-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        A demo with made-up students and parents. This website stands in for the phone call a parent would
        get. Speech by Gnani Prisma and Timbre.
      </p>
    </main>
  );
}
