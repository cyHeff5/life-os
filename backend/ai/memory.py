import json
import os

import anthropic
from sqlalchemy.orm import Session

from models import UserContext

VALID_APPS = {"calendar", "projects", "docs", "fitness", "calories"}

MEMORY_PROMPT = """Du bist ein Gedächtnis-Manager für einen persönlichen KI-Assistenten.
Du pflegst zwei Kontexte: einen allgemeinen und einen app-spezifischen.

ALLGEMEINER KONTEXT (app-übergreifend — Gewohnheiten, Präferenzen, persönliche Infos, wiederkehrende Muster):
{general}

{APP}-KONTEXT (nur relevant für diese App):
{app_context}

NEUE KONVERSATION:
User: {user_message}
KI: {assistant_message}

REGELN:
- Entscheide aktiv: gehört eine Info in den allgemeinen oder den app-spezifischen Kontext?
- Lösche Infos die durch neuere ersetzt wurden (z.B. alter Plan durch neuen Plan)
- Lösche Infos die einmalig relevant waren und jetzt erledigt sind
- Behalte nur Infos die zukünftige Gespräche beeinflussen könnten
- Fasse ähnliche Infos zusammen statt sie anzuhängen
- Halte jeden Kontext so kurz wie möglich, aber so vollständig wie nötig
- Wenn nichts Neues relevant ist, lass den Kontext exakt unverändert

Antworte ausschließlich mit JSON, kein Text davor oder danach:
{{"general": "...", "app": "..."}}"""


def _get_client():
    return anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def load_context(app: str, db: Session) -> tuple[str, str]:
    """Returns (general, app_specific) context strings."""
    general = db.query(UserContext).filter(UserContext.key == "general").first()
    app_ctx = db.query(UserContext).filter(UserContext.key == app).first()
    return (general.value if general else ""), (app_ctx.value if app_ctx else "")


def update_context(app: str, user_message: str, assistant_message: str, db: Session) -> None:
    """Call Haiku to update memory after a conversation turn."""
    if app not in VALID_APPS:
        return

    general, app_ctx = load_context(app, db)

    prompt = MEMORY_PROMPT.format(
        general=general or "(leer)",
        APP=app.upper(),
        app_context=app_ctx or "(leer)",
        user_message=user_message,
        assistant_message=assistant_message,
    )

    try:
        response = _get_client().messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
            raw = raw.rsplit("```", 1)[0].strip()
        data = json.loads(raw)
    except Exception:
        return

    new_general = data.get("general", general)
    new_app     = data.get("app", app_ctx)

    _upsert(db, "general", new_general)
    _upsert(db, app, new_app)
    db.commit()


def _upsert(db: Session, key: str, value: str) -> None:
    row = db.query(UserContext).filter(UserContext.key == key).first()
    if row:
        row.value = value
    else:
        db.add(UserContext(key=key, value=value))
