"""Two ways to run a turn through the same tools and the same dispatcher.

tools:  the real design. Ask the model, run the tools it calls, feed the results
        back, repeat. Two or more requests per turn.
single: one request per turn. The records the read tools would have fetched go
        into the prompt, and the model answers with JSON: what to say, and
        which write tools to run. Gemini's free quota is 15 requests a minute
        at best, and the tool loop ran into it constantly, so this is the default.
"""
import json
from typing import Callable

from .. import config
from ..llm import LLM, Message, ToolCall
from .registry import Registry, ToolContext

MAX_ROUNDS = 4


def answer(llm: LLM, registry: Registry, ctx: ToolContext, history: list[Message], user_text: str,
           prompt: Callable[[dict | None], str], records: Callable[[ToolContext], dict]) -> str:
    """Run one turn in whichever mode is configured."""
    if config.AGENT_MODE == "tools":
        return run_turn(llm, prompt(None), registry, ctx, history, user_text)
    return run_single(llm, prompt(records(ctx)), registry, ctx, history, user_text)


def run_turn(llm: LLM, system: str, registry: Registry, ctx: ToolContext,
             history: list[Message], user_text: str) -> str:
    messages = [*history, Message(role="user", text=user_text)]
    for _ in range(MAX_ROUNDS):
        reply = llm.generate(system, messages, registry.schemas())
        if not reply.tool_calls:
            return reply.text
        messages.append(Message(role="assistant", text=reply.text, tool_calls=reply.tool_calls, raw=reply.raw))
        results = [registry.dispatch(ctx, call) for call in reply.tool_calls]
        messages.append(Message(role="tool", tool_results=results))
    # Out of rounds. Ask once more with no tools so we always end on words.
    return llm.generate(system, messages, None).text


def run_single(llm: LLM, system: str, registry: Registry, ctx: ToolContext,
               history: list[Message], user_text: str) -> str:
    writes = registry.write_tools()
    schema = {
        "type": "object",
        "properties": {
            "say": {"type": "string"},
            "calls": {"type": "object",
                      "properties": {t.name: {"type": "array", "items": t.parameters} for t in writes}},
        },
        "required": ["say", "calls"],
    }
    reply = llm.generate(system, [*history, Message(role="user", text=user_text)], schema=schema)
    try:
        out = json.loads(reply.text)
    except ValueError:
        return reply.text

    # The model spoke before anything was saved. If a call fails, its words are wrong, so say the problem instead.
    problems, done = [], 0
    for name, batch in (out.get("calls") or {}).items():
        for i, args in enumerate(batch or []):
            args = {k: v for k, v in args.items() if v not in (None, "", [])}  # JSON mode fills blanks in
            result = registry.dispatch(ctx, ToolCall(id=f"{name}_{i}", name=name, args=args))
            if "error" in result.content:
                problems.append(result.content["error"])
            else:
                done += 1
    if problems:
        return " ".join(problems) + (" The rest is done." if done else "")
    return (out.get("say") or "").strip()
