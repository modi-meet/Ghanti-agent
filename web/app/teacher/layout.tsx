"use client";

import {
  BellRing,
  BookOpen,
  CalendarCheck,
  ChevronsUpDown,
  Inbox,
  IndianRupee,
  LogOut,
  MessageCircle,
  PhoneOutgoing,
  RotateCcw,
  Send,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";

import { Chip } from "@/components/bits";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { initials } from "@/lib/format";
import { useLogout, useMe } from "@/lib/session";

type Overview = { classes: string[]; inbox_open: number };

const NAV = [
  { label: "Assistant", items: [{ href: "/teacher", title: "Chat", icon: MessageCircle }] },
  {
    label: "Class",
    items: [
      { href: "/teacher/homework", title: "Homework", icon: BookOpen },
      { href: "/teacher/attendance", title: "Attendance", icon: CalendarCheck },
      { href: "/teacher/students", title: "Students", icon: Users },
      { href: "/teacher/fees", title: "Fees", icon: IndianRupee },
    ],
  },
  { label: "Parents", items: [{ href: "/teacher/inbox", title: "Inbox", icon: Inbox }] },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const me = useMe("teacher");
  const logout = useLogout();
  const path = usePathname();
  const { mutate } = useSWRConfig();
  const { data: overview } = useSWR<Overview>(me ? "/teacher/overview" : null, fetcher);
  const [sending, setSending] = useState<string | null>(null);

  if (!me) return null;

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
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2.5 px-1 py-1.5">
            <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-voice text-voice-foreground">
              <BellRing className="size-4" />
            </div>
            <span className="font-semibold tracking-tight group-data-[collapsible=icon]:hidden">Ghanti</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {NAV.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={path === item.href} tooltip={item.title}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.title === "Inbox" && !!overview?.inbox_open && (
                      <SidebarMenuBadge>{overview.inbox_open}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg">
                    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold">
                      {initials(me.name)}
                    </div>
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="text-xs text-muted-foreground">Class teacher</span>
                      <span className="truncate text-sm font-medium">{me.name}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuItem onClick={reset}>
                    <RotateCcw /> Reset demo data
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout}>
                    <LogOut /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-transparent md:p-2">
        <div className="flex min-h-[calc(100dvh-1rem)] flex-col border bg-background md:rounded-3xl">
          <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
            <SidebarTrigger />
            <div className="flex items-center gap-2 rounded-xl border px-2.5 py-1 text-sm">
              <span className="font-medium">Class {overview?.classes.join(", ") ?? "…"}</span>
              <span className="text-muted-foreground">
                {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Chip tone={me.speech_mode === "gnani" ? "good" : "neutral"}>
                {me.speech_mode === "gnani" ? "Gnani speech live" : "Mock speech"}
              </Chip>
              <Button variant="outline" size="sm" disabled={!!sending} onClick={() => send("homework")}>
                <Send /> {sending === "homework" ? "Sending…" : "Send homework"}
              </Button>
              <Button size="sm" disabled={!!sending} onClick={() => send("weekly")}>
                <PhoneOutgoing /> {sending === "weekly" ? "Writing calls…" : "Weekly call"}
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
