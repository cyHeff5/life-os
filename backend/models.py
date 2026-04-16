from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Float, Boolean, ForeignKey, Integer, Index
from sqlalchemy.dialects.postgresql import UUID
import uuid

from database import Base


class Project(Base):
    __tablename__ = "projects"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name        = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    color       = Column(String(7), default="#00a0a0")
    status      = Column(String(20), default="active")   # active | on_hold | completed
    created_at  = Column(DateTime, default=datetime.utcnow)


class WorkArea(Base):
    """Kanban column within a project."""
    __tablename__ = "work_areas"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id  = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name        = Column(String(255), nullable=False)
    order_index = Column(Integer, default=0)
    created_at  = Column(DateTime, default=datetime.utcnow)


class WorkPackage(Base):
    """Kanban card — belongs to a project and optionally a work area."""
    __tablename__ = "work_packages"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id     = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    work_area_id   = Column(UUID(as_uuid=True), ForeignKey("work_areas.id", ondelete="SET NULL"), nullable=True)
    title          = Column(String(255), nullable=False)
    description    = Column(Text, nullable=True)
    status         = Column(String(20), default="todo")     # todo | in_progress | done
    priority       = Column(String(10), default="medium")   # low | medium | high
    estimated_hours = Column(Float, nullable=True)
    is_scheduled   = Column(Boolean, default=False)          # hidden from Calendar sidebar when True
    color          = Column(String(7), default="#00a0a0")
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_wp_project_id", "project_id"),
        Index("ix_wp_work_area_id", "work_area_id"),
        Index("ix_wp_status", "status"),
    )


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title           = Column(String(255), nullable=False)
    start_time      = Column(DateTime, nullable=False)
    end_time        = Column(DateTime, nullable=False)
    color           = Column(String(7), default="#00a0a0")
    work_package_id = Column(UUID(as_uuid=True), ForeignKey("work_packages.id", ondelete="SET NULL"), nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index("ix_calendar_events_start", "start_time"),)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app        = Column(String(50), nullable=False)
    role       = Column(String(10), nullable=False)
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index("ix_chat_app_created", "app", "created_at"),)
