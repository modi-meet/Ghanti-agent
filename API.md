# API

Gnani's speech APIs as we use them. Checked against their docs and a small
smoke test on 14 Nov 2026. Full docs index: docs.gnani.ai/llms.txt

## Access

- Dashboard and keys: https://app.gnani.ai/voice
- Base URL: `https://api.vachana.ai`
- Auth header on every call: `X-API-Key-ID: <key>`
- 5,000 programme credits. The API doesn't report what a call costs, so check the dashboard.
- The free account allows **one request at a time**. A second one gets `429 RATE_LIMITED`, with no Retry-After. We wait and retry.

## What the smoke test showed

| Call | Result | Time |
|---|---|---|
| Timbre v3.0, Hindi, one sentence | good audio | 9.9s |
| Timbre v3.0, Gujarati, one sentence | good audio | 7.2s |
| Timbre v2.5, Hindi, same sentence | good audio | **0.85s** |
| Prisma v3.0 on the Hindi clip | every word right, name included | 0.7s |
| Prisma v3.0 on the Gujarati clip, `indic-auto` | detected `gu-IN`, one word off (પાઠ heard as પાર્ટ) | 0.5s |

So: Timbre v2.5 for anything conversational. v3.0 is too slow for a call.
The Prisma clips were Timbre's own output, so real mic audio still needs a test.

## Speech to text (Prisma)

```bash
curl -X POST https://api.vachana.ai/stt/v3 \
  -H "X-API-Key-ID: $GNANI_API_KEY" \
  -F "audio_file=@clip.wav" \
  -F "model=prisma-v3.0" \
  -F "language_code=hi-IN,en-IN" \
  -F "format=codemix" \
  -F 'keyterms=["Aarav","Kabir","homework"]'
```

- Max 30 seconds per clip. WAV, MP3, OGG, FLAC, AAC, M4A. Not webm, which is why the browser records WAV.
- `model`: leave out for Prisma v2.5, or `prisma-v3.0`.
- `language_code` (v3.0): one to four codes, or `indic-auto` to detect. They're hints, not a lock.
- `format`: `verbatim`, `transcribe` (numbers as digits), `codemix` (English words stay in Latin letters), `transliterate` (everything in Latin letters).
- `keyterms` (v3.0): up to 200 words to favour. We send the class roster.
- `topic`, `previous_text` (v3.0): more context if needed.
- Response: `{"success": true, "transcript": "...", "detected_language_code": "hi-IN", ...}`
- Languages: bn, en, gu, hi, kn, ml, mr, pa, ta, te (all `-IN`).
- Also there, unused: realtime over `wss://api.vachana.ai/stt/v3/stream`, and a batch API for long files with speaker labels.

## Text to speech (Timbre)

```bash
curl -X POST https://api.vachana.ai/api/v1/tts/inference \
  -H "X-API-Key-ID: $GNANI_API_KEY" -H "Content-Type: application/json" \
  -d '{"text": "नमस्ते", "voice": "Yashvi", "model": "timbre-v2.5", "language": "hi-IN",
       "audio_config": {"container": "mp3", "sample_rate": 24000, "bitrate": "64k"}}' \
  -o out.mp3
```

- `container`: `wav` (default), `mp3`, `ogg`, `raw`, `mulaw`, `alaw`. We use mp3 at 64k, about 8 KB per second.
- `speed`: 0.85 to 1.15.
- `language`: a code, `auto`, or `hi-en` for Hinglish.
- Voices belong to a model. A v2.5 voice on v3.0 is a 400.

Timbre v2.5 voices we use (each is tuned for one language):

| Language | Voice | Other options |
|---|---|---|
| Hindi `hi-IN` | Yashvi | Nalini, Bhavna, Chitra, Deepak, Vikrant |
| Gujarati `gu-IN` | Falak | Veera |
| English `en-IN` | Trupti | Kaveri, Devika, Pranav, Shlok |
| Hinglish `hi-en` | Poorvi | |
| Marathi, Kannada, Tamil, Telugu, Bengali | Zahira, Saanvi, Trisha, Lavanya, Kirra | |

Timbre v3.0 has 13 voices that each speak all ten languages (Shivani, Lakshmi,
Avinash...) and inline tags like `<pauses>` and `<laugh>`. Nicer, but slow.

Streaming exists too: SSE at `/api/v1/tts/sse` and `wss://api.vachana.ai/api/v1/tts`.

## Voice cloning

1. `POST /api/v1/tts/voice-clone/embeddings` with `audio_file` (5 to 30s of clear speech) returns a `speaker_embedding`
2. Synthesize with `model: "vachana-vc-v1"` on any TTS endpoint

Not used yet. Could give the weekly call the teacher's own voice.

## The LLM

Evon v3.3 is not on the API. The model card says 63.5 GB of weights, H100/A100
class GPUs, no hosted provider, and that multi-step tool use is still being
worked on. So the agent runs on Gemini, and Prisma + Timbre cover the
"at least one Gnani model" rule.

## Help

- Error reference: docs.gnani.ai/api/introduction/errors
- Gnani Discord: https://discord.gg/aECcvtABpq
