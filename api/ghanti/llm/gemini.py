"""Gemini over plain REST. Evon under vLLM would be a second adapter like this one."""
import logging
import time

import httpx

from .. import config
from . import LLMError, Message, Reply, ToolCall

log = logging.getLogger("ghanti.llm")
URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
BUSY = (429, 500, 503)  # rate limited or overloaded: worth trying another model
MAX_WAIT = 8  # seconds we'll sit out a rate limit before giving up


class GeminiLLM:
    def __init__(self):
        if not config.GEMINI_API_KEY:
            raise LLMError("GEMINI_API_KEY is not set")

    def generate(self, system: str, messages: list[Message], tools: list[dict] | None = None) -> Reply:
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [_content(m) for m in messages],
            "generationConfig": {"temperature": 0.3},
        }
        if tools:
            body["tools"] = [{"functionDeclarations": tools}]

        r = self._try_all(body)
        if r.status_code == 429 and (wait := _retry_delay(r)) <= MAX_WAIT:
            time.sleep(wait)
            r = self._try_all(body)
        if r.status_code != 200:
            raise LLMError(f"Gemini failed ({r.status_code}): {_error(r)}")

        candidates = r.json().get("candidates") or []
        content = (candidates[0].get("content") if candidates else None) or {"role": "model", "parts": []}
        parts = content.get("parts") or []
        text = "".join(p["text"] for p in parts if "text" in p and not p.get("thought")).strip()
        calls = [
            ToolCall(id=p["functionCall"].get("id") or f"call_{i}",
                     name=p["functionCall"]["name"], args=p["functionCall"].get("args") or {})
            for i, p in enumerate(parts) if "functionCall" in p
        ]
        return Reply(text=text, tool_calls=calls, raw=content)

    def _try_all(self, body: dict) -> httpx.Response:
        """Each model has its own quota, so when one is busy the next usually isn't."""
        r = None
        for model in config.GEMINI_MODELS:
            r = httpx.post(URL.format(model=model), json=body, timeout=45,
                           headers={"x-goog-api-key": config.GEMINI_API_KEY})
            if r.status_code not in BUSY:
                return r
            log.warning("%s is busy (%s), trying the next model", model, r.status_code)
        return r


def _error(r: httpx.Response) -> str:
    try:
        return r.json()["error"]["message"].split("\n")[0][:200]
    except Exception:
        return r.text[:200]


def _retry_delay(r: httpx.Response) -> float:
    """Gemini says how long to wait, as "9s", inside the error details."""
    try:
        for detail in r.json()["error"].get("details", []):
            if "retryDelay" in detail:
                return float(detail["retryDelay"].rstrip("s")) + 0.5
    except Exception:
        pass
    return MAX_WAIT + 1


def _content(m: Message) -> dict:
    if m.role == "assistant":
        # Send Gemini's own turn back as it came, so thought signatures survive.
        return m.raw or {"role": "model", "parts": [{"text": m.text}]}
    if m.role == "tool":
        return {"role": "user", "parts": [
            {"functionResponse": {"name": r.name, "response": {"result": r.content}}}
            for r in m.tool_results
        ]}
    return {"role": "user", "parts": [{"text": m.text}]}
