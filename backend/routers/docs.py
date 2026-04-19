import os
import subprocess
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

from dependencies import require_auth

router = APIRouter(prefix="/api/docs", tags=["docs"])

DOCS_ROOT = Path("/latex-docs")


def _latex_escape(s: str) -> str:
    for char, repl in [('\\', r'\textbackslash{}'), ('{', r'\{'), ('}', r'\}'),
                       ('#', r'\#'), ('$', r'\$'), ('%', r'\%'),
                       ('&', r'\&'), ('^', r'\^{}'), ('_', r'\_'), ('~', r'\~{}')]:
        s = s.replace(char, repl)
    return s


def _safe_path(project: str, file_path: str = "") -> Path:
    """Resolve path and ensure it stays within DOCS_ROOT."""
    base = (DOCS_ROOT / project).resolve()
    if file_path:
        full = (base / file_path).resolve()
    else:
        full = base
    if not str(full).startswith(str(DOCS_ROOT)):
        raise HTTPException(status_code=400, detail="Ungültiger Pfad")
    return full


# ── Schemas ───────────────────────────────────────────────────────────────────

class ProjectOut(BaseModel):
    name: str

class FileItem(BaseModel):
    name: str
    path: str
    is_dir: bool

class FileContent(BaseModel):
    content: str

class WriteBody(BaseModel):
    content: str

class CreateProject(BaseModel):
    name: str

class CompileResult(BaseModel):
    success: bool
    log: str


# ── Projects ─────────────────────────────────────────────────────────────────

@router.get("/projects", response_model=list[ProjectOut])
def list_projects(_=Depends(require_auth)):
    DOCS_ROOT.mkdir(exist_ok=True)
    return [
        ProjectOut(name=d.name)
        for d in sorted(DOCS_ROOT.iterdir())
        if d.is_dir() and not d.name.startswith('.')
    ]


@router.post("/projects", response_model=ProjectOut)
def create_project(body: CreateProject, _=Depends(require_auth)):
    path = _safe_path(body.name)
    if path.exists():
        raise HTTPException(status_code=409, detail="Projekt existiert bereits")
    path.mkdir(parents=True)
    # Create a minimal main.tex
    (path / "main.tex").write_text(
        "\\documentclass{article}\n"
        "\\usepackage[utf8]{inputenc}\n"
        "\\usepackage[ngerman]{babel}\n\n"
        "\\title{" + _latex_escape(body.name) + "}\n"
        "\\author{}\n"
        "\\date{\\today}\n\n"
        "\\begin{document}\n"
        "\\maketitle\n\n"
        "\\end{document}\n"
    )
    return ProjectOut(name=body.name)


@router.delete("/projects/{project}")
def delete_project(project: str, _=Depends(require_auth)):
    path = _safe_path(project)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    shutil.rmtree(path)
    return {"status": "deleted"}


# ── Files ─────────────────────────────────────────────────────────────────────

@router.get("/projects/{project}/files", response_model=list[FileItem])
def list_files(project: str, _=Depends(require_auth)):
    base = _safe_path(project)
    if not base.exists():
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    items = []
    for p in sorted(base.rglob("*")):
        if p.name.startswith('.'):
            continue
        rel = str(p.relative_to(base))
        items.append(FileItem(name=p.name, path=rel, is_dir=p.is_dir()))
    return items


@router.get("/projects/{project}/files/{file_path:path}", response_model=FileContent)
def read_file(project: str, file_path: str, _=Depends(require_auth)):
    path = _safe_path(project, file_path)
    if not path.exists() or path.is_dir():
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    return FileContent(content=path.read_text(errors="replace"))


@router.put("/projects/{project}/files/{file_path:path}")
def write_file(project: str, file_path: str, body: WriteBody, _=Depends(require_auth)):
    path = _safe_path(project, file_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body.content)
    return {"status": "saved"}


@router.delete("/projects/{project}/files/{file_path:path}")
def delete_file(project: str, file_path: str, _=Depends(require_auth)):
    path = _safe_path(project, file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    path.unlink()
    return {"status": "deleted"}


# ── Compile ───────────────────────────────────────────────────────────────────

@router.post("/projects/{project}/compile", response_model=CompileResult)
def compile_project(project: str, _=Depends(require_auth)):
    base = _safe_path(project)
    main_tex = base / "main.tex"
    if not main_tex.exists():
        raise HTTPException(status_code=404, detail="main.tex nicht gefunden")
    result = subprocess.run(
        ["pdflatex", "-interaction=nonstopmode", "-output-directory", str(base), str(main_tex)],
        capture_output=True,
        text=True,
        timeout=60,
    )
    # Run twice for references/TOC
    if result.returncode == 0:
        subprocess.run(
            ["pdflatex", "-interaction=nonstopmode", "-output-directory", str(base), str(main_tex)],
            capture_output=True, text=True, timeout=60,
        )
    success = (base / "main.pdf").exists()
    return CompileResult(success=success, log=result.stdout[-3000:] + result.stderr[-1000:])


@router.get("/projects/{project}/pdf")
def get_pdf(project: str, _=Depends(require_auth)):
    path = _safe_path(project, "main.pdf")
    if not path.exists():
        raise HTTPException(status_code=404, detail="PDF nicht gefunden — erst kompilieren")
    return FileResponse(str(path), media_type="application/pdf")
