"""Tools and the dispatcher that runs them: validate args, run, log, never crash the loop."""
import logging
import time
from dataclasses import dataclass, field
from datetime import date
from typing import Callable

from jsonschema import Draft202012Validator
from sqlalchemy.orm import Session

from ..llm import ToolCall, ToolResult
from ..models import Student, User

log = logging.getLogger("ghanti.tools")


class ToolError(Exception):
    """A problem the model can read and fix, like a bad date or an unknown student."""


@dataclass
class ToolContext:
    db: Session
    user: User
    today: date
    # Set by the server from the parent's login. Parent tools read only this student.
    student: Student | None = None
    trace: list[dict] = field(default_factory=list)
    action_ids: list[int] = field(default_factory=list)


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict  # JSON schema, kept to what Gemini's function calling accepts
    handler: Callable[[ToolContext, dict], dict]
    writes: bool = False  # changes something, as opposed to looking something up


class Registry:
    def __init__(self, tools: list[Tool]):
        self.tools = {t.name: t for t in tools}

    def schemas(self) -> list[dict]:
        return [{"name": t.name, "description": t.description, "parameters": t.parameters}
                for t in self.tools.values()]

    def write_tools(self) -> list[Tool]:
        return [t for t in self.tools.values() if t.writes]

    def dispatch(self, ctx: ToolContext, call: ToolCall) -> ToolResult:
        started = time.perf_counter()
        ok, content = True, {}
        tool = self.tools.get(call.name)
        try:
            if tool is None:
                raise ToolError(f"No tool named {call.name}.")
            errors = [e.message for e in Draft202012Validator(tool.parameters).iter_errors(call.args)]
            if errors:
                raise ToolError("Bad arguments: " + "; ".join(errors[:3]))
            content = tool.handler(ctx, call.args)
        except ToolError as e:
            ctx.db.rollback()
            ok, content = False, {"error": str(e)}
        except Exception:
            ctx.db.rollback()
            log.exception("tool %s crashed", call.name)
            ok, content = False, {"error": "The tool failed. Tell the user it did not work."}
        ctx.trace.append({
            "name": call.name, "args": call.args, "ok": ok,
            "ms": round((time.perf_counter() - started) * 1000),
        })
        return ToolResult(id=call.id, name=call.name, content=content)
