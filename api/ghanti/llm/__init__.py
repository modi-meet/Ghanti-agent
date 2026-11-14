"""The LLM gateway. The agent loop only knows these few types, never a provider's wire format."""
from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class ToolCall:
    id: str
    name: str
    args: dict


@dataclass
class ToolResult:
    id: str
    name: str
    content: dict


@dataclass
class Message:
    role: str  # user | assistant | tool
    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_results: list[ToolResult] = field(default_factory=list)
    raw: Any = None  # provider's own copy of an assistant turn, sent back untouched


@dataclass
class Reply:
    text: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    raw: Any = None


class LLMError(Exception):
    pass


class LLM(Protocol):
    def generate(self, system: str, messages: list[Message], tools: list[dict] | None = None,
                 schema: dict | None = None) -> Reply: ...


def get_llm() -> LLM:
    from .gemini import GeminiLLM
    return GeminiLLM()
