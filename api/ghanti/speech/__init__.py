"""Speech in and out. Two adapters with the same two methods: gnani (real) and mock (free)."""
from dataclasses import dataclass
from pathlib import Path

from .. import config

LANGUAGE_NAMES = {
    "en-IN": "English", "hi-IN": "Hindi", "gu-IN": "Gujarati", "mr-IN": "Marathi",
    "kn-IN": "Kannada", "ta-IN": "Tamil", "te-IN": "Telugu", "bn-IN": "Bengali",
}


@dataclass
class Transcript:
    text: str
    language: str = ""


class SpeechError(Exception):
    pass


class MockSpeech:
    """No network, no credits. Says a beep, hears a canned line."""
    name = "mock"

    def transcribe(self, audio: bytes, filename: str, languages: list[str], keyterms: list[str]) -> Transcript:
        return Transcript("(mock speech) Nothing was heard. Set SPEECH_MODE=gnani for real speech.", languages[0])

    def synthesize(self, text: str, language: str) -> bytes:
        return (Path(__file__).parent / "mock.mp3").read_bytes()


def get_speech():
    if config.SPEECH_MODE == "gnani":
        from .gnani import GnaniSpeech
        return GnaniSpeech()
    return MockSpeech()
