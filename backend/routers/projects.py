from collections import defaultdict
from datetime import datetime
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import Project, WorkArea, WorkPackage
from dependencies import require_auth

router = APIRouter(prefix="/api/projects", tags=["projects"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#00a0a0"


class ProjectOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    color: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class WorkAreaCreate(BaseModel):
    name: str


class WorkAreaUpdate(BaseModel):
    name: Optional[str] = None
    order_index: Optional[int] = None


class WorkPackageOut(BaseModel):
    id: UUID
    project_id: UUID
    work_area_id: Optional[UUID]
    title: str
    description: Optional[str]
    status: str
    priority: str
    estimated_hours: Optional[float]
    is_scheduled: bool
    color: str

    class Config:
        from_attributes = True


class WorkAreaOut(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    order_index: int
    work_packages: list[WorkPackageOut] = []

    class Config:
        from_attributes = True


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None


class WorkPackageCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    estimated_hours: Optional[float] = None


class WorkPackageUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    estimated_hours: Optional[float] = None
    is_scheduled: Optional[bool] = None
    work_area_id: Optional[UUID] = None


# ── Projects ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db), _=Depends(require_auth)):
    return db.query(Project).filter(Project.status != "completed").order_by(Project.created_at).all()


@router.post("/", response_model=ProjectOut)
def create_project(data: ProjectCreate, db: Session = Depends(get_db), _=Depends(require_auth)):
    project = Project(**data.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: UUID, data: ProjectUpdate, db: Session = Depends(get_db), _=Depends(require_auth)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(project, k, v)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: UUID, db: Session = Depends(get_db), _=Depends(require_auth)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404)
    db.delete(project)
    db.commit()


# ── Work Areas ────────────────────────────────────────────────────────────────

@router.get("/{project_id}/areas", response_model=list[WorkAreaOut])
def list_areas(project_id: UUID, db: Session = Depends(get_db), _=Depends(require_auth)):
    areas = (
        db.query(WorkArea)
        .filter(WorkArea.project_id == project_id)
        .order_by(WorkArea.order_index, WorkArea.created_at)
        .all()
    )
    area_ids = [a.id for a in areas]
    wps_by_area: dict = defaultdict(list)
    for wp in db.query(WorkPackage).filter(WorkPackage.work_area_id.in_(area_ids)).all():
        wps_by_area[wp.work_area_id].append(wp)
    for area in areas:
        area.work_packages = sorted(
            wps_by_area[area.id],
            key=lambda wp: (1 if wp.status == "done" else 0, wp.created_at),
        )
    return areas


@router.post("/{project_id}/areas", response_model=WorkAreaOut)
def create_area(project_id: UUID, data: WorkAreaCreate, db: Session = Depends(get_db), _=Depends(require_auth)):
    count = db.query(WorkArea).filter(WorkArea.project_id == project_id).count()
    area = WorkArea(project_id=project_id, name=data.name, order_index=count)
    db.add(area)
    db.commit()
    db.refresh(area)
    area.work_packages = []
    return area


@router.patch("/areas/{area_id}", response_model=WorkAreaOut)
def update_area(area_id: UUID, data: WorkAreaUpdate, db: Session = Depends(get_db), _=Depends(require_auth)):
    area = db.query(WorkArea).filter(WorkArea.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(area, k, v)
    db.commit()
    db.refresh(area)
    area.work_packages = db.query(WorkPackage).filter(WorkPackage.work_area_id == area.id).all()
    return area


@router.delete("/areas/{area_id}", status_code=204)
def delete_area(area_id: UUID, db: Session = Depends(get_db), _=Depends(require_auth)):
    area = db.query(WorkArea).filter(WorkArea.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404)
    db.delete(area)
    db.commit()


# ── Work Packages ─────────────────────────────────────────────────────────────

@router.post("/areas/{area_id}/packages", response_model=WorkPackageOut)
def create_package(area_id: UUID, data: WorkPackageCreate, db: Session = Depends(get_db), _=Depends(require_auth)):
    area = db.query(WorkArea).filter(WorkArea.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404)
    project = db.query(Project).filter(Project.id == area.project_id).first()
    wp = WorkPackage(
        project_id=area.project_id,
        work_area_id=area_id,
        color=project.color if project else "#00a0a0",
        **data.model_dump(),
    )
    db.add(wp)
    db.commit()
    db.refresh(wp)
    return wp


@router.patch("/packages/{wp_id}", response_model=WorkPackageOut)
def update_package(wp_id: UUID, data: WorkPackageUpdate, db: Session = Depends(get_db), _=Depends(require_auth)):
    wp = db.query(WorkPackage).filter(WorkPackage.id == wp_id).first()
    if not wp:
        raise HTTPException(status_code=404)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(wp, k, v)
    wp.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(wp)
    return wp


@router.delete("/packages/{wp_id}", status_code=204)
def delete_package(wp_id: UUID, db: Session = Depends(get_db), _=Depends(require_auth)):
    wp = db.query(WorkPackage).filter(WorkPackage.id == wp_id).first()
    if not wp:
        raise HTTPException(status_code=404)
    db.delete(wp)
    db.commit()
