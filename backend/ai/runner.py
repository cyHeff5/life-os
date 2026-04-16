import os
from datetime import datetime
from zoneinfo import ZoneInfo

import anthropic
from sqlalchemy.orm import Session

from ai.registry import get_tools, execute_tool
from ai.prompts import SYSTEM_PROMPT, APP_CONTEXTS
from models import ChatMessage

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

MAX_ITERATIONS = 10
MAX_HISTORY = 10


def chat(app: str, user_message: str, db: Session) -> str:
    now = datetime.now(ZoneInfo("Europe/Berlin"))
    system = SYSTEM_PROMPT.format(
        current_date=now.strftime("%A, %d.%m.%Y"),
        current_time=now.strftime("%H:%M"),
        app_context=APP_CONTEXTS.get(app, ""),
    )

    history = _load_history(db, app)
    history.append({"role": "user", "content": user_message})

    tools = get_tools(app)
    response_text = _run_loop(system, tools, history, app, db)

    _save(db, app, user_message, response_text)
    return response_text


def _run_loop(system: str, tools: list, messages: list, app: str, db: Session) -> str:
    trimmed = messages[-MAX_HISTORY:]

    api_kwargs = dict(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        messages=trimmed,
    )

    if tools:
        cached = tools.copy()
        cached[-1] = {**cached[-1], "cache_control": {"type": "ephemeral"}}
        api_kwargs["tools"] = cached

    for _ in range(MAX_ITERATIONS):
        response = client.messages.create(**api_kwargs)

        if response.stop_reason == "end_turn" or not tools:
            return _extract_text(response)

        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = execute_tool(app, block.name, block.input, db)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })

        if not tool_results:
            return _extract_text(response)

        trimmed = trimmed + [
            {"role": "assistant", "content": response.content},
            {"role": "user", "content": tool_results},
        ]
        api_kwargs["messages"] = trimmed

    return "Maximale Iterationen erreicht."


def _load_history(db: Session, app: str) -> list:
    msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.app == app)
        .order_by(ChatMessage.created_at.desc())
        .limit(MAX_HISTORY)
        .all()
    )
    return [{"role": m.role, "content": m.content} for m in reversed(msgs)]


def _save(db: Session, app: str, user_content: str, assistant_content: str):
    db.add(ChatMessage(app=app, role="user", content=user_content))
    db.add(ChatMessage(app=app, role="assistant", content=assistant_content))
    db.commit()


def _extract_text(response) -> str:
    for block in response.content:
        if hasattr(block, "text"):
            return block.text
    return ""
