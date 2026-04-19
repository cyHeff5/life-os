from datetime import datetime
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import CalendarEvent, WorkPackage, Project
from dependencies import require_auth

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class EventOut(BaseModel):
    id: UUID
    title: str
    start_time: datetime
    end_time: datetime
    color: str
    work_package_id: Optional[UUID] = None


class EventCreate(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime
    color: str = "#00a0a0"
    work_package_id: Optional[UUID] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    color: Optional[str] = None


class WorkPackageOut(BaseModel):
    id: UUID
    title: str
    estimated_hours: Optional[float]
    color: str
    project_id: Optional[UUID] = None


# ── Calendar Events ───────────────────────────────────────────────────────────

@router.get("/events", response_model=list[EventOut])
def get_events(start: str, end: str, db: Session = Depends(get_db), _=Depends(require_auth)):
    start_dt = datetime.fromisoformat(start)
    end_dt = datetime.fromisoformat(end)
    events = (
        db.query(CalendarEvent)
        .filter(CalendarEvent.start_time >= start_dt, CalendarEvent.start_time < end_dt)
        .order_by(CalendarEvent.start_time)
        .all()
    )
    return events


@router.post("/events", response_model=EventOut)
def create_event(data: EventCreate, db: Session = Depends(get_db), _=Depends(require_auth)):
    event = CalendarEvent(**data.model_dump())
    db.add(event)
    if data.work_package_id:
        wp = db.query(WorkPackage).filter(WorkPackage.id == data.work_package_id).first()
        if wp:
            wp.is_scheduled = True
    db.commit()
    db.refresh(event)
    return event


@router.patch("/events/{event_id}", response_model=EventOut)
def update_event(event_id: UUID, data: EventUpdate, db: Session = Depends(get_db), _=Depends(require_auth)):
    event = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/events/{event_id}", status_code=204)
def delete_event(event_id: UUID, db: Session = Depends(get_db), _=Depends(require_auth)):
    event = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.work_package_id:
        wp = db.query(WorkPackage).filter(WorkPackage.id == event.work_package_id).first()
        if wp:
            wp.is_scheduled = False
    db.delete(event)
    db.commit()


# ── Work Packages (for Calendar sidebar) ──────────────────────────────────────

@router.get("/work-packages", response_model=list[WorkPackageOut])
def get_work_packages(db: Session = Depends(get_db), _=Depends(require_auth)):
    """Returns unscheduled, not-done WPs from all active projects."""
    active_project_ids = [
        p.id for p in db.query(Project).filter(Project.status == "active").all()
    ]
    return (
        db.query(WorkPackage)
        .filter(
            WorkPackage.project_id.in_(active_project_ids),
            WorkPackage.status != "done",
        )
        .order_by(WorkPackage.created_at)
        .all()
    )
