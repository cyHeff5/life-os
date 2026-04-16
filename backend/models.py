from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Float, Boolean, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
import uuid

from database import Base


class WorkPackage(Base):
    """Placeholder — will be replaced by project management integration."""
    __tablename__ = "work_packages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    estimated_hours = Column(Float, default=1.0)
    is_scheduled = Column(Boolean, default=False)
    color = Column(String(7), default="#00a0a0")
    created_at = Column(DateTime, default=datetime.utcnow)


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    color = Column(String(7), default="#00a0a0")
    work_package_id = Column(UUID(as_uuid=True), ForeignKey("work_packages.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index("ix_calendar_events_start", "start_time"),)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app = Column(String(50), nullable=False)   # "calendar", "projects", "docs", "fitness", "calories"
    role = Column(String(10), nullable=False)   # "user" or "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_chat_app_created", "app", "created_at"),
    )
