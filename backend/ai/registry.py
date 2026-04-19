import json
import shutil
import urllib.request
import urllib.parse
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from models import CalendarEvent, WorkPackage, WorkArea, Project, Workout, WorkoutExercise, FoodLog

BERLIN = ZoneInfo("Europe/Berlin")
UTC    = ZoneInfo("UTC")


def _parse_dt(s: str) -> datetime:
    """AI provides Berlin-local datetimes → store as naive UTC."""
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=BERLIN)
    return dt.astimezone(UTC).replace(tzinfo=None)


def _fmt_dt(dt: datetime) -> str:
    """Naive UTC from DB → Berlin-local ISO string for AI."""
    return dt.replace(tzinfo=UTC).astimezone(BERLIN).strftime("%Y-%m-%dT%H:%M")


# ── Tool Definitions ──────────────────────────────────────────────────────────

ALL_TOOLS: dict[str, dict] = {
    "get_events": {
        "name": "get_events",
        "description": "Ruft Kalendereinträge für einen Zeitraum ab.",
        "input_schema": {
            "type": "object",
            "properties": {
                "start": {"type": "string", "description": "ISO 8601 in Berliner Zeit, z.B. 2026-04-17T00:00:00"},
                "end":   {"type": "string", "description": "ISO 8601 in Berliner Zeit"},
            },
            "required": ["start", "end"],
        },
    },
    "create_event": {
        "name": "create_event",
        "description": "Erstellt einen neuen Kalendereintrag.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title":      {"type": "string"},
                "start_time": {"type": "string", "description": "ISO 8601 in Berliner Zeit"},
                "end_time":   {"type": "string", "description": "ISO 8601 in Berliner Zeit"},
                "color":      {"type": "string", "description": "Hex-Farbe, Standard #00a0a0"},
            },
            "required": ["title", "start_time", "end_time"],
        },
    },
    "update_event": {
        "name": "update_event",
        "description": "Aktualisiert einen bestehenden Kalendereintrag.",
        "input_schema": {
            "type": "object",
            "properties": {
                "id":         {"type": "string", "description": "UUID des Eintrags"},
                "title":      {"type": "string"},
                "start_time": {"type": "string"},
                "end_time":   {"type": "string"},
                "color":      {"type": "string"},
            },
            "required": ["id"],
        },
    },
    "delete_event": {
        "name": "delete_event",
        "description": "Löscht einen Kalendereintrag.",
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "UUID des Eintrags"},
            },
            "required": ["id"],
        },
    },
    "get_projects": {
        "name": "get_projects",
        "description": "Ruft alle Projekte mit Arbeitsbereichen und Arbeitspaketen ab (inkl. Status und ob bereits eingeplant).",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    "create_work_package": {
        "name": "create_work_package",
        "description": "Erstellt ein neues Arbeitspaket in einem Arbeitsbereich.",
        "input_schema": {
            "type": "object",
            "properties": {
                "area_id":         {"type": "string", "description": "UUID des Arbeitsbereichs"},
                "title":           {"type": "string"},
                "estimated_hours": {"type": "number"},
                "priority":        {"type": "string", "enum": ["low", "medium", "high"]},
                "description":     {"type": "string"},
            },
            "required": ["area_id", "title"],
        },
    },
    "update_work_package": {
        "name": "update_work_package",
        "description": "Aktualisiert ein Arbeitspaket (Titel, Status, Priorität, Stunden).",
        "input_schema": {
            "type": "object",
            "properties": {
                "id":              {"type": "string", "description": "UUID des Arbeitspakets"},
                "title":           {"type": "string"},
                "status":          {"type": "string", "enum": ["todo", "in_progress", "done"]},
                "priority":        {"type": "string", "enum": ["low", "medium", "high"]},
                "estimated_hours": {"type": "number"},
                "description":     {"type": "string"},
            },
            "required": ["id"],
        },
    },
    "schedule_work_package": {
        "name": "schedule_work_package",
        "description": (
            "Plant ein Arbeitspaket in den Kalender ein: erstellt den Kalendereintrag "
            "und markiert das Arbeitspaket als eingeplant. "
            "Wenn end_time fehlt, wird estimated_hours als Dauer verwendet."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "work_package_id": {"type": "string", "description": "UUID des Arbeitspakets"},
                "start_time":      {"type": "string", "description": "ISO 8601 in Berliner Zeit"},
                "end_time":        {"type": "string", "description": "ISO 8601 in Berliner Zeit (optional)"},
            },
            "required": ["work_package_id", "start_time"],
        },
    },
    "list_doc_files": {
        "name": "list_doc_files",
        "description": "Listet alle Dateien in einem LaTeX-Projekt auf.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project": {"type": "string", "description": "Name des Projekts"},
            },
            "required": ["project"],
        },
    },
    "read_doc_file": {
        "name": "read_doc_file",
        "description": "Liest den Inhalt einer Datei in einem LaTeX-Projekt.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project":   {"type": "string", "description": "Name des Projekts"},
                "file_path": {"type": "string", "description": "Relativer Dateipfad, z.B. main.tex"},
            },
            "required": ["project", "file_path"],
        },
    },
    "write_doc_file": {
        "name": "write_doc_file",
        "description": "Schreibt oder überschreibt eine Datei in einem LaTeX-Projekt. Erstellt die Datei falls sie nicht existiert.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project":   {"type": "string", "description": "Name des Projekts"},
                "file_path": {"type": "string", "description": "Relativer Dateipfad"},
                "content":   {"type": "string", "description": "Vollständiger Dateiinhalt"},
            },
            "required": ["project", "file_path", "content"],
        },
    },
    "delete_doc_file": {
        "name": "delete_doc_file",
        "description": "Löscht eine Datei aus einem LaTeX-Projekt.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project":   {"type": "string", "description": "Name des Projekts"},
                "file_path": {"type": "string", "description": "Relativer Dateipfad"},
            },
            "required": ["project", "file_path"],
        },
    },
    "create_doc_folder": {
        "name": "create_doc_folder",
        "description": "Erstellt einen Ordner in einem LaTeX-Projekt.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project":     {"type": "string", "description": "Name des Projekts"},
                "folder_path": {"type": "string", "description": "Relativer Ordnerpfad, z.B. sections"},
            },
            "required": ["project", "folder_path"],
        },
    },
    "delete_doc_folder": {
        "name": "delete_doc_folder",
        "description": "Löscht einen Ordner und seinen gesamten Inhalt aus einem LaTeX-Projekt.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project":     {"type": "string", "description": "Name des Projekts"},
                "folder_path": {"type": "string", "description": "Relativer Ordnerpfad"},
            },
            "required": ["project", "folder_path"],
        },
    },
    "list_code_projects": {
        "name": "list_code_projects",
        "description": "Listet alle Coding-Projekte auf dem Server auf.",
        "input_schema": {"type": "object", "properties": {}},
    },
    "list_code_files": {
        "name": "list_code_files",
        "description": "Listet alle Dateien und Ordner in einem Coding-Projekt auf.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project": {"type": "string", "description": "Name des Projekts"},
            },
            "required": ["project"],
        },
    },
    "read_code_file": {
        "name": "read_code_file",
        "description": "Liest den Inhalt einer Datei in einem Coding-Projekt (read-only).",
        "input_schema": {
            "type": "object",
            "properties": {
                "project":   {"type": "string", "description": "Name des Projekts"},
                "file_path": {"type": "string", "description": "Relativer Dateipfad"},
            },
            "required": ["project", "file_path"],
        },
    },
    "compile_doc": {
        "name": "compile_doc",
        "description": "Kompiliert das LaTeX-Projekt (pdflatex). Gibt Erfolg und Log zurück. Bei Fehlern im Log die Ursache beheben und erneut kompilieren.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project": {"type": "string", "description": "Name des Projekts"},
            },
            "required": ["project"],
        },
    },
    "get_workouts": {
        "name": "get_workouts",
        "description": "Gibt alle definierten Workouts zurück (inkl. Übungen, Dauer, bevorzugter Tag).",
        "input_schema": {"type": "object", "properties": {}},
    },
    "create_workout": {
        "name": "create_workout",
        "description": "Erstellt ein neues Workout in der Bibliothek.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name":          {"type": "string"},
                "type":          {"type": "string", "enum": ["strength", "cardio", "stretch", "mixed"]},
                "color":         {"type": "string", "description": "Hex-Farbe"},
                "duration_min":  {"type": "integer", "description": "Dauer in Minuten"},
                "preferred_day": {"type": "integer", "description": "0=Montag … 6=Sonntag, oder null"},
            },
            "required": ["name"],
        },
    },
    "search_food": {
        "name": "search_food",
        "description": "Sucht Lebensmittel in der Open Food Facts Datenbank nach Namen. Gibt Nährwerte pro 100g zurück.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Suchbegriff, z.B. 'Kartoffeln gekocht' oder 'Haferflocken'"},
            },
            "required": ["query"],
        },
    },
    "log_food": {
        "name": "log_food",
        "description": "Loggt ein Lebensmittel für einen bestimmten Tag. Berechnet Kalorien und Makros automatisch aus den 100g-Werten und der Grammmenge.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name":             {"type": "string", "description": "Name des Lebensmittels"},
                "brand":            {"type": "string", "description": "Marke (optional)"},
                "grams":            {"type": "number", "description": "Menge in Gramm"},
                "kcal_per_100g":    {"type": "number", "description": "Kalorien pro 100g"},
                "protein_per_100g": {"type": "number", "description": "Protein pro 100g"},
                "fat_per_100g":     {"type": "number", "description": "Fett pro 100g"},
                "carbs_per_100g":   {"type": "number", "description": "Kohlenhydrate pro 100g"},
                "date":             {"type": "string", "description": "Datum im Format YYYY-MM-DD, Standard: heute"},
            },
            "required": ["name", "grams", "kcal_per_100g"],
        },
    },
    "get_food_logs": {
        "name": "get_food_logs",
        "description": "Gibt alle geloggten Lebensmittel für einen Tag zurück.",
        "input_schema": {
            "type": "object",
            "properties": {
                "date": {"type": "string", "description": "Datum im Format YYYY-MM-DD, Standard: heute"},
            },
        },
    },
    "add_workout_exercise": {
        "name": "add_workout_exercise",
        "description": "Fügt eine Übung zu einem Workout hinzu.",
        "input_schema": {
            "type": "object",
            "properties": {
                "workout_id":   {"type": "string"},
                "name":         {"type": "string"},
                "sets":         {"type": "integer"},
                "reps":         {"type": "string", "description": "z.B. '8-12' oder '10'"},
                "weight_kg":    {"type": "number"},
                "duration_min": {"type": "number"},
                "distance_km":  {"type": "number"},
            },
            "required": ["workout_id", "name"],
        },
    },
}


# ── Whitelists per App ────────────────────────────────────────────────────────

APP_TOOL_WHITELIST: dict[str, list[str]] = {
    "calendar": [
        "get_events", "create_event", "update_event", "delete_event",
        "get_projects", "schedule_work_package",
    ],
    "projects": [
        "get_projects", "create_work_package", "update_work_package",
        "schedule_work_package", "get_events",
        "list_code_projects", "list_code_files", "read_code_file",
    ],
    "docs":     ["list_doc_files", "read_doc_file", "write_doc_file", "delete_doc_file", "create_doc_folder", "delete_doc_folder", "compile_doc", "get_projects", "list_code_projects", "list_code_files", "read_code_file"],
    "fitness":  ["get_workouts", "create_workout", "add_workout_exercise", "get_events", "create_event"],
    "calories": ["search_food", "log_food", "get_food_logs"],
}


# ── Executors ─────────────────────────────────────────────────────────────────

def _exec_get_events(inp: dict, db: Session) -> str:
    start_dt = _parse_dt(inp["start"])
    end_dt   = _parse_dt(inp["end"])
    events = (
        db.query(CalendarEvent)
        .filter(CalendarEvent.start_time >= start_dt, CalendarEvent.start_time < end_dt)
        .order_by(CalendarEvent.start_time)
        .all()
    )
    return json.dumps([
        {
            "id":    str(e.id),
            "title": e.title,
            "start": _fmt_dt(e.start_time),
            "end":   _fmt_dt(e.end_time),
            "color": e.color,
            "work_package_id": str(e.work_package_id) if e.work_package_id else None,
        }
        for e in events
    ], ensure_ascii=False)


def _exec_create_event(inp: dict, db: Session) -> str:
    event = CalendarEvent(
        title=inp["title"],
        start_time=_parse_dt(inp["start_time"]),
        end_time=_parse_dt(inp["end_time"]),
        color=inp.get("color", "#00a0a0"),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return json.dumps({"id": str(event.id), "status": "created"})


def _exec_update_event(inp: dict, db: Session) -> str:
    event = db.query(CalendarEvent).filter(CalendarEvent.id == UUID(inp["id"])).first()
    if not event:
        return json.dumps({"error": "Event nicht gefunden"})
    for field in ["title", "color"]:
        if field in inp:
            setattr(event, field, inp[field])
    for field in ["start_time", "end_time"]:
        if field in inp:
            setattr(event, field, _parse_dt(inp[field]))
    db.commit()
    return json.dumps({"status": "updated"})


def _exec_delete_event(inp: dict, db: Session) -> str:
    event = db.query(CalendarEvent).filter(CalendarEvent.id == UUID(inp["id"])).first()
    if not event:
        return json.dumps({"error": "Event nicht gefunden"})
    if event.work_package_id:
        wp = db.query(WorkPackage).filter(WorkPackage.id == event.work_package_id).first()
        if wp:
            wp.is_scheduled = False
    db.delete(event)
    db.commit()
    return json.dumps({"status": "deleted"})


def _exec_get_projects(inp: dict, db: Session) -> str:
    projects = db.query(Project).order_by(Project.created_at).all()
    project_ids = [p.id for p in projects]

    areas_by_project: dict = defaultdict(list)
    for a in db.query(WorkArea).filter(WorkArea.project_id.in_(project_ids)).order_by(WorkArea.order_index).all():
        areas_by_project[a.project_id].append(a)

    all_areas = [a for areas in areas_by_project.values() for a in areas]
    area_ids = [a.id for a in all_areas]
    wps_by_area: dict = defaultdict(list)
    for wp in db.query(WorkPackage).filter(WorkPackage.work_area_id.in_(area_ids)).order_by(WorkPackage.created_at).all():
        wps_by_area[wp.work_area_id].append(wp)

    result = []
    for p in projects:
        result.append({
            "id":          str(p.id),
            "name":        p.name,
            "status":      p.status,
            "description": p.description,
            "areas": [
                {
                    "id":   str(a.id),
                    "name": a.name,
                    "work_packages": [
                        {
                            "id":              str(wp.id),
                            "title":           wp.title,
                            "description":     wp.description,
                            "status":          wp.status,
                            "priority":        wp.priority,
                            "estimated_hours": wp.estimated_hours,
                            "is_scheduled":    wp.is_scheduled,
                        }
                        for wp in wps_by_area[a.id]
                    ],
                }
                for a in areas_by_project[p.id]
            ],
        })
    return json.dumps(result, ensure_ascii=False)


def _exec_create_work_package(inp: dict, db: Session) -> str:
    area = db.query(WorkArea).filter(WorkArea.id == UUID(inp["area_id"])).first()
    if not area:
        return json.dumps({"error": "Arbeitsbereich nicht gefunden"})
    wp = WorkPackage(
        work_area_id=area.id,
        project_id=area.project_id,
        title=inp["title"],
        estimated_hours=inp.get("estimated_hours", 1.0),
        priority=inp.get("priority", "medium"),
        description=inp.get("description", ""),
    )
    db.add(wp)
    db.commit()
    db.refresh(wp)
    return json.dumps({"id": str(wp.id), "status": "created"})


def _exec_update_work_package(inp: dict, db: Session) -> str:
    wp = db.query(WorkPackage).filter(WorkPackage.id == UUID(inp["id"])).first()
    if not wp:
        return json.dumps({"error": "Arbeitspaket nicht gefunden"})
    for field in ["title", "status", "priority", "estimated_hours", "description"]:
        if field in inp:
            setattr(wp, field, inp[field])
    db.commit()
    return json.dumps({"status": "updated"})


def _exec_schedule_work_package(inp: dict, db: Session) -> str:
    wp = db.query(WorkPackage).filter(WorkPackage.id == UUID(inp["work_package_id"])).first()
    if not wp:
        return json.dumps({"error": "Arbeitspaket nicht gefunden"})
    start_dt = _parse_dt(inp["start_time"])
    end_dt   = _parse_dt(inp["end_time"]) if "end_time" in inp else (
        start_dt + timedelta(hours=float(wp.estimated_hours or 1.0))
    )
    event = CalendarEvent(
        title=wp.title,
        start_time=start_dt,
        end_time=end_dt,
        color=wp.color or "#00a0a0",
        work_package_id=wp.id,
    )
    db.add(event)
    wp.is_scheduled = True
    db.commit()
    db.refresh(event)
    return json.dumps({"event_id": str(event.id), "status": "scheduled"})


# ── Docs Executors ────────────────────────────────────────────────────────────

DOCS_ROOT = Path("/latex-docs")

def _exec_list_doc_files(inp: dict, db: Session) -> str:
    base = (DOCS_ROOT / inp["project"]).resolve()
    if not base.exists():
        return json.dumps({"error": "Projekt nicht gefunden"})
    files = [
        str(p.relative_to(base))
        for p in sorted(base.rglob("*"))
        if p.is_file() and not p.name.startswith('.')
    ]
    return json.dumps(files)


def _exec_read_doc_file(inp: dict, db: Session) -> str:
    path = (DOCS_ROOT / inp["project"] / inp["file_path"]).resolve()
    if not str(path).startswith(str(DOCS_ROOT)):
        return json.dumps({"error": "Ungültiger Pfad"})
    if not path.exists():
        return json.dumps({"error": "Datei nicht gefunden"})
    return json.dumps({"content": path.read_text(errors="replace")})


def _exec_write_doc_file(inp: dict, db: Session) -> str:
    path = (DOCS_ROOT / inp["project"] / inp["file_path"]).resolve()
    if not str(path).startswith(str(DOCS_ROOT)):
        return json.dumps({"error": "Ungültiger Pfad"})
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(inp["content"])
    return json.dumps({"status": "saved"})


def _exec_delete_doc_file(inp: dict, db: Session) -> str:
    path = (DOCS_ROOT / inp["project"] / inp["file_path"]).resolve()
    if not str(path).startswith(str(DOCS_ROOT)):
        return json.dumps({"error": "Ungültiger Pfad"})
    if not path.exists():
        return json.dumps({"error": "Datei nicht gefunden"})
    path.unlink()
    return json.dumps({"status": "deleted"})


def _exec_create_doc_folder(inp: dict, db: Session) -> str:
    path = (DOCS_ROOT / inp["project"] / inp["folder_path"]).resolve()
    if not str(path).startswith(str(DOCS_ROOT)):
        return json.dumps({"error": "Ungültiger Pfad"})
    path.mkdir(parents=True, exist_ok=True)
    return json.dumps({"status": "created"})


def _exec_delete_doc_folder(inp: dict, db: Session) -> str:
    path = (DOCS_ROOT / inp["project"] / inp["folder_path"]).resolve()
    if not str(path).startswith(str(DOCS_ROOT)):
        return json.dumps({"error": "Ungültiger Pfad"})
    if not path.exists():
        return json.dumps({"error": "Ordner nicht gefunden"})
    shutil.rmtree(path)
    return json.dumps({"status": "deleted"})


CODE_ROOT = Path("/code-projects")

IGNORED_DIRS  = {'.git', '__pycache__', 'node_modules', '.venv', 'venv', '.next', 'dist', 'build', '.mypy_cache'}
IGNORED_EXTS  = {'.pyc', '.pyo', '.class', '.o', '.so', '.dll', '.exe', '.lock'}
MAX_FILE_SIZE = 100_000  # 100KB


def _exec_list_code_projects(inp: dict, db: Session) -> str:
    CODE_ROOT.mkdir(exist_ok=True)
    projects = [d.name for d in sorted(CODE_ROOT.iterdir()) if d.is_dir() and not d.name.startswith('.')]
    return json.dumps(projects)


def _exec_list_code_files(inp: dict, db: Session) -> str:
    base = (CODE_ROOT / inp["project"]).resolve()
    if not str(base).startswith(str(CODE_ROOT)) or not base.exists():
        return json.dumps({"error": "Projekt nicht gefunden"})
    items = []
    for p in sorted(base.rglob("*")):
        if any(part in IGNORED_DIRS for part in p.parts):
            continue
        if p.suffix in IGNORED_EXTS or p.name.startswith('.'):
            continue
        rel = str(p.relative_to(base))
        items.append({"path": rel, "is_dir": p.is_dir(), "size": p.stat().st_size if p.is_file() else None})
    return json.dumps(items)


def _exec_read_code_file(inp: dict, db: Session) -> str:
    path = (CODE_ROOT / inp["project"] / inp["file_path"]).resolve()
    if not str(path).startswith(str(CODE_ROOT)):
        return json.dumps({"error": "Ungültiger Pfad"})
    if not path.exists() or path.is_dir():
        return json.dumps({"error": "Datei nicht gefunden"})
    if path.stat().st_size > MAX_FILE_SIZE:
        return json.dumps({"error": f"Datei zu groß (>{MAX_FILE_SIZE//1000}KB)"})
    return json.dumps({"content": path.read_text(errors="replace")})


def _exec_get_workouts(inp: dict, db: Session) -> str:
    workouts = db.query(Workout).order_by(Workout.created_at).all()
    workout_ids = [w.id for w in workouts]
    exs_by_workout: dict = defaultdict(list)
    for e in db.query(WorkoutExercise).filter(WorkoutExercise.workout_id.in_(workout_ids)).order_by(WorkoutExercise.order_index).all():
        exs_by_workout[e.workout_id].append(e)
    result = [
        {
            "id": str(w.id), "name": w.name, "type": w.type,
            "duration_min": w.duration_min, "preferred_day": w.preferred_day,
            "exercises": [{"name": e.name, "sets": e.sets, "reps": e.reps, "weight_kg": e.weight_kg,
                           "duration_min": e.duration_min, "distance_km": e.distance_km}
                          for e in exs_by_workout[w.id]],
        }
        for w in workouts
    ]
    return json.dumps(result, ensure_ascii=False)


def _exec_create_workout(inp: dict, db: Session) -> str:
    w = Workout(
        name=inp["name"],
        type=inp.get("type", "strength"),
        color=inp.get("color", "#00a0a0"),
        duration_min=inp.get("duration_min", 60),
        preferred_day=inp.get("preferred_day"),
    )
    db.add(w)
    db.commit()
    db.refresh(w)
    return json.dumps({"id": str(w.id), "status": "created"})


def _exec_add_workout_exercise(inp: dict, db: Session) -> str:
    from uuid import UUID as _UUID
    w = db.query(Workout).filter(Workout.id == _UUID(inp["workout_id"])).first()
    if not w:
        return json.dumps({"error": "Workout nicht gefunden"})
    e = WorkoutExercise(
        workout_id=w.id,
        name=inp["name"],
        sets=inp.get("sets"),
        reps=inp.get("reps"),
        weight_kg=inp.get("weight_kg"),
        duration_min=inp.get("duration_min"),
        distance_km=inp.get("distance_km"),
    )
    db.add(e)
    db.commit()
    return json.dumps({"status": "added"})


def _exec_search_food(inp: dict, db: Session) -> str:
    params = urllib.parse.urlencode({
        "q":         inp["query"],
        "fields":    "product_name,brands,nutriments,lang",
        "page_size": "20",
    })
    url = f"https://search.openfoodfacts.org/search?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "life-os/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        return json.dumps({"error": f"Netzwerkfehler: {e}"})
    de_results, other_results = [], []
    for p in data.get("hits", []):
        n = p.get("nutriments", {})
        kcal = n.get("energy-kcal_100g") or (n.get("energy_100g", 0) / 4.184)
        name = p.get("product_name") or p.get("product_name_de") or ""
        if kcal and name:
            brands = p.get("brands", "")
            entry = {
                "name":             name,
                "brand":            ", ".join(brands) if isinstance(brands, list) else brands,
                "kcal_per_100g":    round(float(kcal), 1),
                "protein_per_100g": round(float(n.get("proteins_100g") or 0), 1),
                "fat_per_100g":     round(float(n.get("fat_100g") or 0), 1),
                "carbs_per_100g":   round(float(n.get("carbohydrates_100g") or 0), 1),
            }
            (de_results if p.get("lang") == "de" else other_results).append(entry)
    return json.dumps((de_results + other_results)[:5], ensure_ascii=False)


def _exec_log_food(inp: dict, db: Session) -> str:
    from datetime import date
    log_date = date.fromisoformat(inp["date"]) if inp.get("date") else date.today()
    g = float(inp["grams"])
    entry = FoodLog(
        date=log_date,
        name=inp["name"],
        brand=inp.get("brand", ""),
        grams=g,
        kcal=round(float(inp["kcal_per_100g"]) * g / 100, 1),
        protein=round(float(inp.get("protein_per_100g") or 0) * g / 100, 1),
        fat=round(float(inp.get("fat_per_100g") or 0) * g / 100, 1),
        carbs=round(float(inp.get("carbs_per_100g") or 0) * g / 100, 1),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return json.dumps({
        "id": str(entry.id), "name": entry.name,
        "grams": entry.grams, "kcal": entry.kcal, "status": "logged",
    }, ensure_ascii=False)


def _exec_get_food_logs(inp: dict, db: Session) -> str:
    from datetime import date
    log_date = date.fromisoformat(inp["date"]) if inp.get("date") else date.today()
    logs = db.query(FoodLog).filter(FoodLog.date == log_date).order_by(FoodLog.created_at).all()
    total_kcal = sum(l.kcal for l in logs)
    return json.dumps({
        "date": str(log_date),
        "total_kcal": round(total_kcal, 1),
        "entries": [
            {"name": l.name, "brand": l.brand, "grams": l.grams,
             "kcal": l.kcal, "protein": l.protein, "fat": l.fat, "carbs": l.carbs}
            for l in logs
        ],
    }, ensure_ascii=False)


def _exec_compile_doc(inp: dict, db: Session) -> str:
    import subprocess
    base = (DOCS_ROOT / inp["project"]).resolve()
    main_tex = base / "main.tex"
    if not main_tex.exists():
        return json.dumps({"success": False, "error": "main.tex nicht gefunden"})
    result = subprocess.run(
        ["pdflatex", "-interaction=nonstopmode", "-output-directory", str(base), str(main_tex)],
        capture_output=True, text=True, timeout=60,
    )
    if result.returncode == 0:
        subprocess.run(
            ["pdflatex", "-interaction=nonstopmode", "-output-directory", str(base), str(main_tex)],
            capture_output=True, text=True, timeout=60,
        )
    success = (base / "main.pdf").exists()
    log = result.stdout[-2000:] + result.stderr[-500:]
    return json.dumps({"success": success, "log": log})


# ── Public API ────────────────────────────────────────────────────────────────

_EXECUTORS = {
    "get_events":            _exec_get_events,
    "create_event":          _exec_create_event,
    "update_event":          _exec_update_event,
    "delete_event":          _exec_delete_event,
    "get_projects":          _exec_get_projects,
    "create_work_package":   _exec_create_work_package,
    "update_work_package":   _exec_update_work_package,
    "schedule_work_package": _exec_schedule_work_package,
    "list_code_projects":    _exec_list_code_projects,
    "list_code_files":       _exec_list_code_files,
    "read_code_file":        _exec_read_code_file,
    "list_doc_files":        _exec_list_doc_files,
    "read_doc_file":         _exec_read_doc_file,
    "write_doc_file":        _exec_write_doc_file,
    "delete_doc_file":       _exec_delete_doc_file,
    "create_doc_folder":     _exec_create_doc_folder,
    "delete_doc_folder":     _exec_delete_doc_folder,
    "compile_doc":           _exec_compile_doc,
    "search_food":           _exec_search_food,
    "log_food":              _exec_log_food,
    "get_food_logs":         _exec_get_food_logs,
    "get_workouts":          _exec_get_workouts,
    "create_workout":        _exec_create_workout,
    "add_workout_exercise":  _exec_add_workout_exercise,
}


def get_tools(app: str) -> list:
    return [ALL_TOOLS[n] for n in APP_TOOL_WHITELIST.get(app, []) if n in ALL_TOOLS]


def execute_tool(app: str, tool_name: str, tool_input: dict, db: Session) -> str:
    if tool_name not in APP_TOOL_WHITELIST.get(app, []):
        return json.dumps({"error": f"Tool '{tool_name}' ist in dieser App nicht verfügbar."})
    executor = _EXECUTORS.get(tool_name)
    if not executor:
        return json.dumps({"error": f"Tool '{tool_name}' nicht implementiert."})
    return executor(tool_input, db)
