"""A fake LLM that plays back queued replies. For tests, so the loop runs with no key."""
from . import Message, Reply


class ScriptedLLM:
    def __init__(self, replies: list[Reply]):
        self.replies = list(replies)
        self.seen: list[list[Message]] = []

    def generate(self, system: str, messages: list[Message], tools: list[dict] | None = None,
                 schema: dict | None = None) -> Reply:
        self.seen.append(list(messages))
        return self.replies.pop(0)
