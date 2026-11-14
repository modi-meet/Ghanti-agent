// Thin wrapper over fetch. Every call goes to /api/*, which Next proxies to FastAPI.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`/api${path}`, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    let message = `Something went wrong (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {}
    throw new ApiError(res.status, message);
  }
  return res.json();
}

// For SWR: the key is the path.
export const fetcher = <T,>(path: string) => api<T>(path);

// Send either a voice clip or typed text to an agent endpoint.
export function say<T>(path: string, input: { audio?: Blob; text?: string }) {
  const form = new FormData();
  if (input.audio) form.append("audio", input.audio, "clip.wav");
  if (input.text) form.append("text", input.text);
  return api<T>(path, { method: "POST", body: form });
}

// ---- shapes the backend returns ----

export type Me = {
  id: number;
  name: string;
  role: "teacher" | "parent";
  language: string;
  child?: string;
  speech_mode?: "mock" | "gnani";
};

export type Action = {
  id: number;
  kind: "homework" | "attendance" | "note" | "fee";
  title: string;
  lines: string[];
  status: "applied" | "pending" | "undone";
};

export type ToolTrace = { name: string; args: Record<string, unknown>; ok: boolean; ms: number };

export type Turn = {
  id: number;
  role: "user" | "assistant";
  text: string;
  audio_url: string | null;
  trace: ToolTrace[];
  actions: Action[];
  created_at: string;
};

export type Exchange = { user: Turn; assistant: Turn };

export const LANGUAGES: Record<string, string> = {
  "en-IN": "English",
  "hi-IN": "Hindi",
  "gu-IN": "Gujarati",
  "mr-IN": "Marathi",
  "kn-IN": "Kannada",
  "ta-IN": "Tamil",
};
