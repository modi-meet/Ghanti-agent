"use client";

import { Microphone } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { Spinner } from "@/components/ui/spinner";
import { useRecorder } from "@/lib/recorder";
import { cn } from "@/lib/utils";

// Hold to talk, let go to send. Works with mouse, touch and the space bar.
export function MicButton({
  onClip,
  busy,
  large,
  onRecording,
}: {
  onClip: (clip: Blob) => void;
  busy?: boolean;
  large?: boolean;
  onRecording?: (recording: boolean) => void;
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
  useEffect(() => onRecording?.(recording), [recording, onRecording]);

  const begin = async () => {
    if (busy || recording) return;
    try {
      await start();
    } catch {
      toast.error("Can't reach the microphone. Allow mic access in the browser and try again.");
    }
  };

  const icon = large ? "size-8" : "size-[18px]";
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={recording ? "Recording, let go to send" : "Hold to talk"}
      title="Hold to talk"
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
        "relative grid shrink-0 touch-none place-items-center rounded-full bg-voice text-voice-foreground select-none",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_1px_2px_rgb(0_0_0/0.15)] transition-transform duration-150",
        "outline-none focus-visible:ring-3 focus-visible:ring-voice/40 disabled:opacity-60",
        large ? "size-[76px]" : "size-9",
        recording && "scale-110",
      )}
    >
      {recording && <span className="absolute -inset-1.5 animate-ping rounded-full border-2 border-voice" />}
      {busy ? <Spinner className={icon} /> : <Microphone weight="fill" className={icon} />}
    </button>
  );
}
