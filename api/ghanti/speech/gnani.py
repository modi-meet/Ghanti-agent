"""Gnani's Prisma (speech to text) and Timbre (text to speech) over REST."""
import json
import re
import time

import httpx

from .. import config
from . import SpeechError, Transcript

BASE = "https://api.vachana.ai"

# Timbre v2.5 answers in under a second. v3.0 took 7 to 10s for one sentence in our smoke test.
TTS_MODEL = "timbre-v2.5"
VOICES = {
    "hi-IN": "Yashvi", "gu-IN": "Falak", "en-IN": "Trupti", "mr-IN": "Zahira",
    "kn-IN": "Saanvi", "ta-IN": "Trisha", "te-IN": "Lavanya", "bn-IN": "Kirra",
    "hi-en": "Poorvi",  # Hinglish, used when talking back to the teacher
}
TTS_CHUNK = 350  # characters per request, split on sentence ends


class GnaniSpeech:
    name = "gnani"

    def __init__(self):
        if not config.GNANI_API_KEY:
            raise SpeechError("GNANI_API_KEY is not set")
        self.headers = {"X-API-Key-ID": config.GNANI_API_KEY}

    def _post(self, url: str, **kwargs) -> httpx.Response:
        # The free account allows one request at a time, so a 429 just means wait a bit.
        for attempt in range(3):
            r = httpx.post(url, headers=self.headers, timeout=40, **kwargs)
            if r.status_code != 429:
                return r
            time.sleep(0.6 * (attempt + 1))
        return r

    def transcribe(self, audio: bytes, filename: str, languages: list[str], keyterms: list[str]) -> Transcript:
        data = {
            "model": "prisma-v3.0",
            "language_code": ",".join(languages[:4]),
            # codemix keeps English words in Latin letters, which is how school talk sounds
            "format": "codemix",
        }
        if keyterms:
            data["keyterms"] = json.dumps(keyterms[:200], ensure_ascii=False)
        r = self._post(f"{BASE}/stt/v3", data=data, files={"audio_file": (filename, audio)})
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code != 200 or not body.get("success"):
            raise SpeechError(f"Prisma failed ({r.status_code}): {str(body or r.text)[:200]}")
        return Transcript(body.get("transcript", "").strip(), body.get("detected_language_code", ""))

    def synthesize(self, text: str, language: str) -> bytes:
        voice = VOICES.get(language, VOICES["hi-IN"])
        out = b""
        for chunk in _chunks(text):
            r = self._post(f"{BASE}/api/v1/tts/inference", json={
                "text": chunk, "voice": voice, "model": TTS_MODEL, "language": language,
                "audio_config": {"container": "mp3", "sample_rate": 24000, "bitrate": "64k"},
            })
            if r.status_code != 200:
                raise SpeechError(f"Timbre failed ({r.status_code}): {r.text[:200]}")
            out += r.content  # mp3 frames can simply be joined
        return out


def _chunks(text: str) -> list[str]:
    sentences = re.split(r"(?<=[.!?।])\s+", text.strip())
    chunks, current = [], ""
    for s in sentences:
        if current and len(current) + len(s) > TTS_CHUNK:
            chunks.append(current)
            current = s
        else:
            current = f"{current} {s}".strip()
    if current:
        chunks.append(current)
    return chunks
