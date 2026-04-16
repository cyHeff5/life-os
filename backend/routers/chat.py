from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import ChatMessage
from ai.runner import chat
from dependencies import require_auth

router = APIRouter(prefix="/api/chat", tags=["chat"])

HISTORY_LIMIT = 40
VALID_APPS = {"calendar", "projects", "docs", "fitness", "calories"}


class MessageOut(BaseModel):
    id: Optional[UUID] = None
    role: str
    content: str


class ChatRequest(BaseModel):
    app: str
    message: str


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
    response = chat(body.app, body.message, db)
    return ChatResponse(response=response)
