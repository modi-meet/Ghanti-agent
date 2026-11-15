"""The Gnani adapter, with the network stubbed out."""
import httpx

from ghanti import config
from ghanti.speech.gnani import GnaniSpeech


def test_a_repeated_language_is_sent_once(monkeypatch):
    # An English-speaking parent's call asks for [their language, English], which is en-IN twice.
    sent = {}

    def post(url, **kwargs):
        sent.update(kwargs["data"])
        return httpx.Response(200, json={"success": True, "transcript": "hello"})

    monkeypatch.setattr(config, "GNANI_API_KEY", "test")
    monkeypatch.setattr(httpx, "post", post)
    assert GnaniSpeech().transcribe(b"x", "clip.wav", ["en-IN", "en-IN"], []).text == "hello"
    assert sent["language_code"] == "en-IN"
