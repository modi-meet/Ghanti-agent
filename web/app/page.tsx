"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useMe } from "@/lib/session";

// Nothing lives at /. Logged in goes to your side, logged out goes to /login.
export default function Home() {
  const me = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me) router.replace(`/${me.role}`);
  }, [me, router]);
  return null;
}
