"""Gemini over plain REST. Evon under vLLM would be a second adapter like this one."""
import time

import httpx

from .. import config
from . import LLMError, Message, Reply, ToolCall

URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


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

        r = None
        for attempt in range(3):
            r = httpx.post(URL.format(model=config.GEMINI_MODEL), json=body, timeout=45,
                           headers={"x-goog-api-key": config.GEMINI_API_KEY})
            if r.status_code not in (429, 500, 503):
                break
            time.sleep(1.5 * (attempt + 1))
        if r.status_code != 200:
            try:
                detail = r.json()["error"]["message"]
            except Exception:
                detail = r.text[:200]
            raise LLMError(f"Gemini failed ({r.status_code}): {detail}")

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
