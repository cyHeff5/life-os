"""Tool registry — maps each app to its available tools and executor."""

from sqlalchemy.orm import Session

# Each app gets a list of Anthropic tool definitions and an executor function.
# Tools are added here as apps are built.

APP_TOOLS: dict[str, list] = {
    "calendar":  [],
    "projects":  [],
    "docs":      [],
    "fitness":   [],
    "calories":  [],
}


def get_tools(app: str) -> list:
    return APP_TOOLS.get(app, [])


def execute_tool(app: str, tool_name: str, tool_input: dict, db: Session) -> str:
    """Route a tool call to the correct executor for the given app."""
    # Executors are registered here as apps are built.
    executors: dict[str, dict] = {
        "calendar":  {},
        "projects":  {},
        "docs":      {},
        "fitness":   {},
        "calories":  {},
    }
    handler = executors.get(app, {}).get(tool_name)
    if handler:
        return handler(tool_input, db)
    return f"Tool '{tool_name}' not found for app '{app}'."
