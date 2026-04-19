from collections import defaultdict
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_auth
from models import Workout, WorkoutExercise

router = APIRouter(prefix="/api/fitness", tags=["fitness"])

DAYS_DE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']


# ── Schemas ───────────────────────────────────────────────────────────────────

class WorkoutCreate(BaseModel):
    name: str
    type: str = "strength"
    color: str = "#00a0a0"
    duration_min: int = 60
    preferred_day: Optional[int] = None

class WorkoutUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    color: Optional[str] = None
    duration_min: Optional[int] = None
    preferred_day: Optional[int] = None

class ExerciseCreate(BaseModel):
    name: str
    order_index: int = 0
    sets: Optional[int] = None
    reps: Optional[str] = None
    weight_kg: Optional[float] = None
    duration_min: Optional[float] = None
    distance_km: Optional[float] = None
    notes: Optional[str] = None

class ExerciseUpdate(BaseModel):
    name: Optional[str] = None
    order_index: Optional[int] = None
    sets: Optional[int] = None
    reps: Optional[str] = None
    weight_kg: Optional[float] = None
    duration_min: Optional[float] = None
    distance_km: Optional[float] = None
    notes: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ex_out(e: WorkoutExercise) -> dict:
    return {
        "id": str(e.id),
        "order_index": e.order_index,
        "name": e.name,
        "sets": e.sets,
        "reps": e.reps,
        "weight_kg": e.weight_kg,
        "duration_min": e.duration_min,
        "distance_km": e.distance_km,
        "notes": e.notes,
    }

def _workout_out(w: Workout, exercises: list) -> dict:
    return {
        "id": str(w.id),
        "name": w.name,
        "type": w.type,
        "color": w.color,
        "duration_min": w.duration_min,
        "preferred_day": w.preferred_day,
        "preferred_day_label": DAYS_DE[w.preferred_day] if w.preferred_day is not None else None,
        "exercises": [_ex_out(e) for e in exercises],
    }


def _load_workouts(workouts: list, db: Session) -> list:
    ids = [w.id for w in workouts]
    exs_by_workout: dict = defaultdict(list)
    for e in (
        db.query(WorkoutExercise)
        .filter(WorkoutExercise.workout_id.in_(ids))
        .order_by(WorkoutExercise.order_index)
        .all()
    ):
        exs_by_workout[e.workout_id].append(e)
    return [_workout_out(w, exs_by_workout[w.id]) for w in workouts]


# ── Workouts ──────────────────────────────────────────────────────────────────

@router.get("/workouts")
def list_workouts(db: Session = Depends(get_db), _=Depends(require_auth)):
    workouts = db.query(Workout).order_by(Workout.created_at).all()
    return _load_workouts(workouts, db)


@router.get("/workouts/today")
def workouts_today(day: Optional[int] = None, db: Session = Depends(get_db), _=Depends(require_auth)):
    """Return workouts whose preferred_day matches the given day index (0=Mon)."""
    if day is None:
        from datetime import datetime
        from zoneinfo import ZoneInfo
        day = (datetime.now(ZoneInfo("Europe/Berlin")).weekday())  # 0=Mon
    workouts = (
        db.query(Workout)
        .filter(Workout.preferred_day == day)
        .order_by(Workout.created_at)
        .all()
    )
    return _load_workouts(workouts, db)


@router.post("/workouts", status_code=201)
def create_workout(body: WorkoutCreate, db: Session = Depends(get_db), _=Depends(require_auth)):
    w = Workout(
        name=body.name, type=body.type, color=body.color,
        duration_min=body.duration_min, preferred_day=body.preferred_day,
    )
    db.add(w)
    db.commit()
    db.refresh(w)
    return _load_workouts([w], db)[0]


@router.patch("/workouts/{workout_id}")
def update_workout(workout_id: UUID, body: WorkoutUpdate, db: Session = Depends(get_db), _=Depends(require_auth)):
    w = db.query(Workout).filter(Workout.id == workout_id).first()
    if not w:
        raise HTTPException(404)
    for field in ["name", "type", "color", "duration_min", "preferred_day"]:
        val = getattr(body, field)
        if val is not None:
            setattr(w, field, val)
    # Allow clearing preferred_day explicitly
    if body.preferred_day is None and "preferred_day" in body.model_fields_set:
        w.preferred_day = None
    db.commit()
    return _load_workouts([w], db)[0]


@router.delete("/workouts/{workout_id}", status_code=204)
def delete_workout(workout_id: UUID, db: Session = Depends(get_db), _=Depends(require_auth)):
    w = db.query(Workout).filter(Workout.id == workout_id).first()
    if not w:
        raise HTTPException(404)
    db.delete(w)
    db.commit()


# ── Exercises ─────────────────────────────────────────────────────────────────

@router.post("/workouts/{workout_id}/exercises", status_code=201)
def add_exercise(workout_id: UUID, body: ExerciseCreate, db: Session = Depends(get_db), _=Depends(require_auth)):
    w = db.query(Workout).filter(Workout.id == workout_id).first()
    if not w:
        raise HTTPException(404)
    e = WorkoutExercise(
        workout_id=w.id,
        order_index=body.order_index,
        name=body.name,
        sets=body.sets,
        reps=body.reps,
        weight_kg=body.weight_kg,
        duration_min=body.duration_min,
        distance_km=body.distance_km,
        notes=body.notes,
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return _ex_out(e)


@router.patch("/exercises/{exercise_id}")
def update_exercise(exercise_id: UUID, body: ExerciseUpdate, db: Session = Depends(get_db), _=Depends(require_auth)):
    e = db.query(WorkoutExercise).filter(WorkoutExercise.id == exercise_id).first()
    if not e:
        raise HTTPException(404)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(e, field, value)
    db.commit()
    return _ex_out(e)


@router.delete("/exercises/{exercise_id}", status_code=204)
def delete_exercise(exercise_id: UUID, db: Session = Depends(get_db), _=Depends(require_auth)):
    e = db.query(WorkoutExercise).filter(WorkoutExercise.id == exercise_id).first()
    if not e:
        raise HTTPException(404)
    db.delete(e)
    db.commit()
