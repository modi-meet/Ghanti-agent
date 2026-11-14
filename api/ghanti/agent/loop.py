"""The agent loop: ask the model, run the tools it wants, feed results back, repeat."""
from ..llm import LLM, Message
from .registry import Registry, ToolContext

MAX_ROUNDS = 4


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
