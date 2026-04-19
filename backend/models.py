from datetime import datetime, date as date_type
from sqlalchemy import Column, String, Text, DateTime, Date, Float, Boolean, ForeignKey, Integer, Index
from sqlalchemy.dialects.postgresql import UUID
import uuid

from database import Base


class Project(Base):
    __tablename__ = "projects"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name        = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    color       = Column(String(7), default="#00a0a0")
    status      = Column(String(20), default="active")
    created_at  = Column(DateTime, default=datetime.utcnow)


class WorkArea(Base):
    __tablename__ = "work_areas"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id  = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name        = Column(String(255), nullable=False)
    order_index = Column(Integer, default=0)
    created_at  = Column(DateTime, default=datetime.utcnow)


class WorkPackage(Base):
    __tablename__ = "work_packages"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id      = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    work_area_id    = Column(UUID(as_uuid=True), ForeignKey("work_areas.id", ondelete="SET NULL"), nullable=True)
    title           = Column(String(255), nullable=False)
    description     = Column(Text, nullable=True)
    status          = Column(String(20), default="todo")
    priority        = Column(String(10), default="medium")
    estimated_hours = Column(Float, nullable=True)
    is_scheduled    = Column(Boolean, default=False)
    color           = Column(String(7), default="#00a0a0")
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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


class UserContext(Base):
    __tablename__ = "user_context"

    key        = Column(String(50), primary_key=True)
    value      = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Workout(Base):
    __tablename__ = "workouts"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name          = Column(String(255), nullable=False)
    type          = Column(String(20), default="strength")  # strength | cardio | stretch | mixed
    color         = Column(String(7), default="#00a0a0")
    duration_min  = Column(Integer, default=60)
    preferred_day = Column(Integer, nullable=True)          # 0=Mon … 6=Sun
    created_at    = Column(DateTime, default=datetime.utcnow)


class WorkoutExercise(Base):
    __tablename__ = "workout_exercises"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workout_id   = Column(UUID(as_uuid=True), ForeignKey("workouts.id", ondelete="CASCADE"), nullable=False)
    order_index  = Column(Integer, default=0)
    name         = Column(String(255), nullable=False)
    sets         = Column(Integer, nullable=True)
    reps         = Column(String(50), nullable=True)    # "8-12" or "10"
    weight_kg    = Column(Float, nullable=True)
    duration_min = Column(Float, nullable=True)
    distance_km  = Column(Float, nullable=True)
    notes        = Column(String(255), nullable=True)

    __table_args__ = (Index("ix_workout_exercises_workout", "workout_id"),)


class FoodLog(Base):
    __tablename__ = "food_logs"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date       = Column(Date, nullable=False, default=date_type.today)
    name       = Column(String(255), nullable=False)
    brand      = Column(String(255), nullable=True)
    grams      = Column(Float, nullable=False)
    kcal       = Column(Float, nullable=False)
    protein    = Column(Float, nullable=True)
    fat        = Column(Float, nullable=True)
    carbs      = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index("ix_food_logs_date", "date"),)


class StockWatchlist(Base):
    __tablename__ = "stock_watchlist"

    symbol   = Column(String(10), primary_key=True)
    name     = Column(String(255), nullable=True)
    added_at = Column(DateTime, default=datetime.utcnow)


class StockAnalysisCache(Base):
    __tablename__ = "stock_analysis_cache"

    symbol         = Column(String(10), primary_key=True)
    regime         = Column(String(50),  nullable=True)
    risk_tag       = Column(String(20),  nullable=True)
    news_signal    = Column(String(20),  nullable=True)
    recommendation = Column(String(20),  nullable=True)
    price          = Column(Float,       nullable=True)
    news_json      = Column(Text,        nullable=True)
    updated_at     = Column(DateTime,    default=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app        = Column(String(50), nullable=False)
    role       = Column(String(10), nullable=False)
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index("ix_chat_app_created", "app", "created_at"),)
