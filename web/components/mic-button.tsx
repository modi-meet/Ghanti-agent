"use client";

import { Loader2, Mic } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { useRecorder } from "@/lib/recorder";
import { cn } from "@/lib/utils";

// Hold to talk, let go to send. Works with mouse, touch and the space bar.
export function MicButton({
  onClip,
  busy,
  large,
}: {
  onClip: (clip: Blob) => void;
  busy?: boolean;
  large?: boolean;
}) {
  const finishRef = useRef<() => void>(() => {});
  const { recording, start, stop } = useRecorder(useCallback(() => finishRef.current(), []));

  const finish = useCallback(async () => {
    const clip = await stop();
    if (clip) onClip(clip);
  }, [stop, onClip]);
  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  const begin = async () => {
    if (busy || recording) return;
    try {
      await start();
    } catch {
      toast.error("Can't reach the microphone. Allow mic access, or type instead.");
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      aria-label={recording ? "Recording, let go to send" : "Hold to talk"}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        begin();
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onKeyDown={(e) => e.key === " " && !e.repeat && begin()}
      onKeyUp={(e) => e.key === " " && finish()}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "relative grid shrink-0 touch-none place-items-center rounded-full bg-voice text-voice-foreground transition-transform select-none",
        "outline-none focus-visible:ring-3 focus-visible:ring-voice/40 disabled:opacity-60",
        large ? "size-20" : "size-11",
        recording && "scale-110",
      )}
    >
      {recording && <span className="absolute inset-0 animate-ping rounded-full bg-voice/50" />}
      {busy ? (
        <Loader2 className={cn("animate-spin", large ? "size-7" : "size-4.5")} />
      ) : (
        <Mic className={cn("relative", large ? "size-7" : "size-4.5")} />
      )}
    </button>
  );
}
