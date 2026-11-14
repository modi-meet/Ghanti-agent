"use client";

import { useSyncExternalStore } from "react";

// One audio element for the whole app. Phones only let a page play sound after
// a tap, and reusing the element that tap unlocked keeps later replies audible.

let audio: HTMLAudioElement | null = null;
let current: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function element() {
  if (!audio) {
    audio = new Audio();
    audio.onended = audio.onerror = () => {
      current = null;
      notify();
    };
  }
  return audio;
}

export function play(url: string): Promise<void> {
  const el = element();
  el.src = url;
  current = url;
  notify();
  return el.play().catch(() => {
    current = null;
    notify();
  });
}

// A 44-byte WAV header with no samples: enough to count as "the user started audio".
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

// Call inside a click handler before any awaits, so a reply fetched later may still play.
export function unlock() {
  const el = element();
  el.src = SILENCE;
  el.play().catch(() => {});
}

export function stop() {
  if (!audio) return;
  audio.pause();
  current = null;
  notify();
}

// Which url is playing right now, or null.
export function usePlaying() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}
