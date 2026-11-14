"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import useSWR, { mutate } from "swr";

import { api, fetcher, type Me } from "@/lib/api";

// Who is logged in. Sends you to /login if nobody is, or to your own side if
// you wandered into the other one.
export function useMe(role?: Me["role"]) {
  const router = useRouter();
  const { data: me, error } = useSWR<Me>("/auth/me", fetcher, { shouldRetryOnError: false });

  useEffect(() => {
    if (error) router.replace("/login");
    else if (me && role && me.role !== role) router.replace(`/${me.role}`);
  }, [me, error, role, router]);

  return me && (!role || me.role === role) ? me : undefined;
}

// Forget every cached response, so the next login never sees the last one's data.
const forgetAll = () => mutate(() => true, undefined, { revalidate: false });

export function useLogin() {
  const router = useRouter();
  return async (account: Me) => {
    await api("/auth/login", { method: "POST", json: { user_id: account.id } });
    await forgetAll();
    router.replace(`/${account.role}`);
  };
}

export function useLogout() {
  const router = useRouter();
  return async () => {
    await api("/auth/logout", { method: "POST" });
    await forgetAll();
    router.replace("/login");
  };
}
