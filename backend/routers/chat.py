from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import ChatMessage
from ai.runner import chat
from ai.memory import load_context, _upsert
from dependencies import require_auth

router = APIRouter(prefix="/api/chat", tags=["chat"])

HISTORY_LIMIT = 15
VALID_APPS = {"calendar", "projects", "docs", "fitness", "calories"}


class MessageOut(BaseModel):
    id: Optional[UUID] = None
    role: str
    content: str


class ChatRequest(BaseModel):
    app: str
    message: str
    extra_context: Optional[str] = None


class ChatResponse(BaseModel):
    response: str


@router.get("/history/{app}", response_model=list[MessageOut])
def get_history(app: str, db: Session = Depends(get_db), _=Depends(require_auth)):
    if app not in VALID_APPS:
        raise HTTPException(status_code=400, detail="Unknown app")
    msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.app == app)
        .order_by(ChatMessage.created_at.desc())
        .limit(HISTORY_LIMIT)
        .all()
    )
    return [MessageOut(id=m.id, role=m.role, content=m.content) for m in reversed(msgs)]


@router.delete("/message/{message_id}", status_code=204)
def delete_message(message_id: UUID, db: Session = Depends(get_db), _=Depends(require_auth)):
    msg = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    db.delete(msg)
    db.commit()


@router.post("/", response_model=ChatResponse)
def send_message(body: ChatRequest, db: Session = Depends(get_db), _=Depends(require_auth)):
    if body.app not in VALID_APPS:
        raise HTTPException(status_code=400, detail="Unknown app")
    response = chat(body.app, body.message, db, extra_context=body.extra_context)
    return ChatResponse(response=response)


class ContextOut(BaseModel):
    general: str
    app: str


class ContextUpdate(BaseModel):
    general: Optional[str] = None
    app: Optional[str] = None


@router.get("/context/{app}", response_model=ContextOut)
def get_context(app: str, db: Session = Depends(get_db), _=Depends(require_auth)):
    if app not in VALID_APPS:
        raise HTTPException(status_code=400, detail="Unknown app")
    general, app_ctx = load_context(app, db)
    return ContextOut(general=general, app=app_ctx)


@router.patch("/context/{app}", response_model=ContextOut)
def update_context_endpoint(app: str, body: ContextUpdate, db: Session = Depends(get_db), _=Depends(require_auth)):
    if app not in VALID_APPS:
        raise HTTPException(status_code=400, detail="Unknown app")
    if body.general is not None:
        _upsert(db, "general", body.general)
    if body.app is not None:
        _upsert(db, app, body.app)
    db.commit()
    general, app_ctx = load_context(app, db)
    return ContextOut(general=general, app=app_ctx)
