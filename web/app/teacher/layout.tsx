"use client";

import {
  ArrowCounterClockwise,
  BellRinging,
  BookOpenText,
  CalendarCheck,
  CaretUpDown,
  ChatCircleDots,
  CurrencyInr,
  PaperPlaneTilt,
  PhoneOutgoing,
  SignOut,
  Tray,
  UsersThree,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";

import { Person, Status } from "@/components/bits";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { api, fetcher } from "@/lib/api";
import { useLogout, useMe } from "@/lib/session";

type Overview = { classes: string[]; inbox_open: number; homework: unknown[] };

const NAV = [
  { label: "Assistant", items: [{ href: "/teacher", title: "Chat", icon: ChatCircleDots }] },
  {
    label: "Class",
    items: [
      { href: "/teacher/homework", title: "Homework", icon: BookOpenText },
      { href: "/teacher/attendance", title: "Attendance", icon: CalendarCheck },
      { href: "/teacher/students", title: "Students", icon: UsersThree },
      { href: "/teacher/fees", title: "Fees", icon: CurrencyInr },
    ],
  },
  { label: "Parents", items: [{ href: "/teacher/inbox", title: "Inbox", icon: Tray }] },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const me = useMe("teacher");
  const logout = useLogout();
  const path = usePathname();
  const { mutate } = useSWRConfig();
  const { data: overview } = useSWR<Overview>(me ? "/teacher/overview" : null, fetcher);
  const [sending, setSending] = useState<string | null>(null);

  if (!me) return null;

  const counts: Record<string, number | undefined> = {
    Homework: overview?.homework.length,
    Inbox: overview?.inbox_open,
  };

  // Refetch everything on screen. Used after anything that changes school data.
  const refresh = () => mutate((key) => typeof key === "string" && key.startsWith("/teacher"));

  async function send(kind: "homework" | "weekly") {
    setSending(kind);
    try {
      const { sent } = await api<{ sent: number }>("/teacher/send", { method: "POST", json: { kind } });
      if (sent) toast.success(`Sent to ${sent} parents, each in their own language.`);
      else toast(kind === "homework" ? "No homework added today, or it was already sent." : "Already sent today.");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSending(null);
  }

  async function reset() {
    await api("/teacher/reset", { method: "POST" });
    await refresh();
    toast.success("Demo data is back to where it started.");
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "15rem" } as React.CSSProperties}>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <div className="flex h-9 items-center gap-2.5 px-1">
            <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-voice text-voice-foreground">
              <BellRinging weight="fill" className="size-4" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight group-data-[collapsible=icon]:hidden">Ghanti</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {NAV.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = path === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title} className="rounded-xl">
                        <Link href={item.href}>
                          <item.icon weight={active ? "fill" : "regular"} />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {!!counts[item.title] && <SidebarMenuBadge>{counts[item.title]}</SidebarMenuBadge>}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="rounded-xl">
                    <Person name={me.name} />
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-medium">{me.name}</span>
                      <span className="text-xs text-muted-foreground">
                        Class teacher, {overview?.classes.join(", ")}
                      </span>
                    </div>
                    <CaretUpDown className="ml-auto text-muted-foreground" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuItem onClick={reset}>
                    <ArrowCounterClockwise /> Reset demo data
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout}>
                    <SignOut /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-h-[calc(100dvh-1rem)] border md:peer-data-[variant=inset]:rounded-3xl md:peer-data-[variant=inset]:shadow-none">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger className="text-muted-foreground" />
          <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
          <div className="text-sm">
            <span className="font-medium">Class {overview?.classes.join(", ")}</span>
            <span className="ml-2 hidden text-muted-foreground sm:inline">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="mr-1 hidden md:inline-flex">
              <Status tone={me.speech_mode === "gnani" ? "good" : "neutral"}>
                {me.speech_mode === "gnani" ? "Gnani speech live" : "Mock speech"}
              </Status>
            </span>
            <Button variant="outline" size="sm" disabled={!!sending} onClick={() => send("homework")}>
              <PaperPlaneTilt weight="fill" /> {sending === "homework" ? "Sending…" : "Send homework"}
            </Button>
            <Button size="sm" disabled={!!sending} onClick={() => send("weekly")}>
              <PhoneOutgoing weight="fill" /> {sending === "weekly" ? "Writing calls…" : "Weekly call"}
            </Button>
          </div>
        </header>
        <div className="flex-1 px-5 py-6 md:px-8 md:py-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
