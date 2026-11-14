"use client";

import { useCallback, useRef, useState } from "react";

// Records the mic straight to a 16 kHz mono WAV. Prisma takes WAV but not the
// webm that MediaRecorder gives, and there is no ffmpeg on the server to convert.

const TARGET_RATE = 16000;
const MAX_SECONDS = 28; // Prisma's REST limit is 30s per clip
const MIN_SECONDS = 0.4; // shorter than this was a stray tap

type Session = {
  ctx: AudioContext;
  stream: MediaStream;
  node: ScriptProcessorNode;
  chunks: Float32Array[];
  timer: ReturnType<typeof setTimeout>;
};

export function useRecorder(onAutoStop?: () => void) {
  const session = useRef<Session | null>(null);
  const [recording, setRecording] = useState(false);

  const start = useCallback(async () => {
    if (session.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const node = ctx.createScriptProcessor(4096, 1, 1);
    const chunks: Float32Array[] = [];
    node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    source.connect(node);
    node.connect(ctx.destination);
    const timer = setTimeout(() => onAutoStop?.(), MAX_SECONDS * 1000);
    session.current = { ctx, stream, node, chunks, timer };
    setRecording(true);
  }, [onAutoStop]);

  // Resolves with the clip, or null if it was too short to mean anything.
  const stop = useCallback(async (): Promise<Blob | null> => {
    const s = session.current;
    if (!s) return null;
    session.current = null;
    setRecording(false);
    clearTimeout(s.timer);
    s.node.disconnect();
    s.stream.getTracks().forEach((t) => t.stop());
    const rate = s.ctx.sampleRate;
    await s.ctx.close();

    const samples = downsample(flatten(s.chunks), rate);
    if (samples.length < TARGET_RATE * MIN_SECONDS) return null;
    return wav(samples);
  }, []);

  return { recording, start, stop };
}

function flatten(chunks: Float32Array[]) {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

// Average each run of input samples into one output sample.
function downsample(input: Float32Array, rate: number) {
  if (rate <= TARGET_RATE) return input;
  const ratio = rate / TARGET_RATE;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const from = Math.floor(i * ratio);
    const to = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = from; j < to; j++) sum += input[j];
    out[i] = sum / (to - from);
  }
  return out;
}

function wav(samples: Float32Array) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, TARGET_RATE, true);
  view.setUint32(28, TARGET_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}
