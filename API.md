# API

Gnani's API platform, as described in their quick start
(docs.gnani.ai/api/introduction/quick-start). Nothing here has been run yet,
so smoke test before trusting it. Full docs index: docs.gnani.ai/llms.txt

## Access

- Dashboard and keys: https://app.gnani.ai/voice (sign in with the registered email)
- Base URL: `https://api.vachana.ai`
- Auth header on every call: `X-API-Key-ID: <key>`
- Budget: 5,000 programme credits. Usage shows in the dashboard. What a credit buys isn't published, so check after the first few calls.

## Models

| Model | What | Notes |
|---|---|---|
| Prisma v2.5 | speech to text | default. 10+ Indian languages, Hinglish/Tanglish/Benglish, trained on phone audio |
| Prisma v3.0 | speech to text | `model=prisma-v3.0`, supports `language_code=indic-auto` |
| Timbre v2.5 | text to speech | `timbre-v2.5`, marked beta. Handles Indian names, numerals, lakh/crore |
| vachana-vc-v1 | voice cloning | needs a speaker embedding first |
| Evon v3.3 | LLM, 30B MoE, 128K ctx | **not on the API.** HF weights: `gnani/gnani-evon-v3.3-30B-A3B`, gated |

## Speech to text

REST, for short clips (max ~30 seconds per request):

```bash
curl -X POST https://api.vachana.ai/stt/v3 \
  -H "X-API-Key-ID: $GNANI_API_KEY" \
  -F "audio_file=@clip.wav" \
  -F "model=prisma-v3.0" \
  -F "language_code=indic-auto"
```

Audio: WAV, MP3, OGG, FLAC, AAC or M4A, 8 to 44.1 kHz.

Realtime: `wss://api.vachana.ai/stt/v3/stream`

- Headers: `x-api-key-id`, `model`, `language_code`, `x-sample-rate`
- Send binary 16-bit mono PCM, 8 or 16 kHz, 1024 bytes per frame
- Send `{"type": "commit"}` when done
- Get back JSON messages with `"type": "transcript"`

Longer files: there's a batch transcription API (docs: `/api/STTBatch/Introduction`).

## Text to speech

REST, returns a WAV:

```bash
curl -X POST https://api.vachana.ai/api/v1/tts/inference \
  -H "X-API-Key-ID: $GNANI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "नमस्ते", "voice": "Nalini", "model": "timbre-v2.5", "language": "hi-IN"}' \
  -o out.wav
```

Optional fields: `speed`, `audio_config`.

- Streaming (SSE): `POST /api/v1/tts/sse`, events `start`, `chunk` (base64 audio), `complete`
- Realtime: `wss://api.vachana.ai/api/v1/tts`

## Voice cloning

1. `POST /api/v1/tts/voice-clone/embeddings` with `audio_file` (5 to 30s of clear speech) returns a `speaker_embedding`
2. Synthesize with `model: "vachana-vc-v1"` on any TTS endpoint

## The LLM question

Evon needs a GPU box to host, which doesn't fit a one-day build. The rule is
"at least one Gnani model", so Prisma + Timbre cover it and the reasoning step
can run on Gemini. If there's time left, swap Evon in behind the same interface.

## Other bits

- Pipecat and LiveKit plugins exist (docs.gnani.ai/pipecat, /livekit) if we go full realtime.
- Error reference: docs.gnani.ai/api/introduction/errors
- Help: Gnani Discord, https://discord.gg/aECcvtABpq
