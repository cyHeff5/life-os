import { useState, useEffect, useCallback } from 'react'
import { AppShell } from '../components/AppShell'
import { CalendarPanel } from '../components/CalendarPanel'
import { api } from '../api/client'

// ── Constants ──────────────────────────────────────────────────────────────
const PROJECT_COLORS = [
  '#00a0a0', '#6366f1', '#ec4899', '#f59e0b',
  '#10b981', '#ef4444', '#8b5cf6', '#06b6d4',
]

const PRIORITY_COLOR = { high: '#ef4444', medium: '#00a0a0', low: '#2a6060' }

// ── WP Card ────────────────────────────────────────────────────────────────
function WpCard({ wp, projectColor, onToggleDone, onDelete }) {
  const isDone = wp.status === 'done'

  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: wp.id,
      title: wp.title,
      estimated_hours: wp.estimated_hours || 1,
      color: projectColor || wp.color || '#00a0a0',
    }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`group flex items-start gap-2 p-2.5 border border-[#1e4040] bg-[#080e0e] hover:border-[#3a7070] transition-colors mb-1.5 cursor-grab active:cursor-grabbing ${
        isDone ? 'opacity-40' : ''
      }`}
    >
      {/* Priority dot */}
      <div
        className="w-1.5 h-1.5 mt-1.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: PRIORITY_COLOR[wp.priority] || PRIORITY_COLOR.medium }}
      />

      <div className="flex-1 min-w-0">
        <p className={`text-[15px] leading-snug ${isDone ? 'line-through text-[#2a6060]' : 'text-[#5aacac]'}`}>
          {wp.title}
        </p>
        {wp.description && !isDone && (
          <p className="text-[13px] text-[#2a6060] mt-0.5 leading-snug truncate">{wp.description}</p>
        )}
        {wp.estimated_hours && (
          <p className="text-[12px] text-[#3a7070] mt-0.5">{wp.estimated_hours}h</p>
        )}
      </div>

      {/* Done toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleDone(wp.id, isDone) }}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex-shrink-0 text-[22px] leading-none transition-colors mt-0.5 ${
          isDone ? 'text-[#00a0a0] hover:text-[#2a6060]' : 'text-[#3a7070] hover:text-[#5aacac]'
        }`}
      >
        {isDone ? '✓' : '○'}
      </button>

      {/* Delete */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(wp.id) }}
        onMouseDown={(e) => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 text-[#3a7070] hover:text-[#cc2222] text-[13px] transition-all flex-shrink-0 mt-0.5"
      >✕</button>
    </div>
  )
}

// ── Kanban Column ──────────────────────────────────────────────────────────
function KanbanColumn({ area, projectColor, onToggleDone, onDeleteWp, onDeleteArea, onAddWp }) {
  const [newTitle, setNewTitle] = useState('')
  const open  = area.work_packages.filter(wp => wp.status !== 'done').length
  const total = area.work_packages.length

  const handleAdd = async (e) => {
    if (e.key !== 'Enter' || !newTitle.trim()) return
    await onAddWp(area.id, { title: newTitle.trim() })
    setNewTitle('')
  }

  return (
    <div className="flex-shrink-0 w-[260px] border-r border-[#1e4040] flex flex-col bg-[#050909] h-full">
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1e4040] flex-shrink-0">
        <span className="text-[14px] uppercase tracking-[0.2em] text-[#5aacac]">{area.name}</span>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-[#3a7070]">{open}/{total}</span>
          <button
            onClick={() => onDeleteArea(area.id)}
            className="text-[#3a7070] hover:text-[#cc2222] text-[13px] transition-colors"
          >✕</button>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-2">
        {area.work_packages.map(wp => (
          <WpCard
            key={wp.id}
            wp={wp}
            projectColor={projectColor}
            onToggleDone={onToggleDone}
            onDelete={onDeleteWp}
          />
        ))}
      </div>

      {/* Add WP input */}
      <div className="px-2 py-2 border-t border-[#1e4040] flex-shrink-0">
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={handleAdd}
          placeholder="+ Aufgabe hinzufügen"
          className="w-full bg-transparent text-[14px] text-[#5aacac] placeholder-[#3a7070] focus:outline-none px-1 py-0.5"
        />
      </div>
    </div>
  )
}

// ── Project Grid ───────────────────────────────────────────────────────────
function ProjectGrid({ projects, onSelect, onAdd, onDelete }) {
  const [newName, setNewName]   = useState('')
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0])
  const [adding, setAdding]     = useState(false)
  const [addError, setAddError] = useState('')
  const [confirmId, setConfirmId] = useState(null)

  const handleAdd = async (e) => {
    if (e.key !== 'Enter' || !newName.trim()) return
    setAddError('')
    try {
      await onAdd({ name: newName.trim(), color: newColor })
      setNewName('')
      setAdding(false)
    } catch (err) {
      setAddError(String(err))
    }
  }

  return (
    <div className="p-6 overflow-y-auto no-scrollbar h-full">
      <div className="grid grid-cols-3 gap-4 max-w-[900px]">
        {projects.map(p => {
          const openCount = 0  // could be fetched, but keep it simple
          return (
            <div
              key={p.id}
              className="group relative text-left p-4 border border-[#1e4040] hover:border-[#3a7070] bg-[#080e0e] hover:bg-[#0d1e1e] transition-all cursor-pointer"
              onClick={() => onSelect(p)}
            >
              {confirmId === p.id ? (
                <div className="absolute top-2 right-2 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  <span className="text-[11px] text-[#cc4444]">Sicher?</span>
                  <button
                    autoFocus
                    onBlur={() => setConfirmId(null)}
                    onClick={() => { onDelete(p.id); setConfirmId(null) }}
                    className="text-[11px] text-[#cc4444] border border-[#cc4444] px-1.5 hover:bg-[#cc4444] hover:text-white transition-colors uppercase tracking-wider"
                  >Ja</button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmId(p.id) }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-[#2a4040] hover:text-[#cc2222] text-[13px] transition-all"
                >✕</button>
              )}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-[15px] uppercase tracking-[0.2em] text-[#5aacac] group-hover:text-[#00cccc] transition-colors truncate">
                  {p.name}
                </span>
              </div>
              {p.description && (
                <p className="text-[13px] text-[#2a6060] truncate">{p.description}</p>
              )}
              <p className="text-[12px] uppercase tracking-wider text-[#3a7070] mt-2">
                {p.status === 'active' ? 'Aktiv' : p.status === 'on_hold' ? 'Pausiert' : p.status}
              </p>
            </div>
          )
        })}

        {/* Add project */}
        {adding ? (
          <div className="p-4 border border-[#3a7070] bg-[#0d1e1e]">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={handleAdd}
              onBlur={() => { if (!newName.trim()) setAdding(false) }}
              placeholder="Projektname"
              className="w-full bg-transparent text-[15px] text-[#5aacac] placeholder-[#2a6060] focus:outline-none mb-3"
            />
            <div className="flex gap-1.5 flex-wrap">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-4 h-4 rounded-full transition-all ${newColor === c ? 'ring-2 ring-offset-1 ring-offset-[#0d1e1e]' : ''}`}
                  style={{ backgroundColor: c, ringColor: c }}
                />
              ))}
            </div>
            {addError
              ? <p className="text-[12px] text-[#cc2222] mt-2">{addError}</p>
              : <p className="text-[12px] text-[#3a7070] mt-2">Enter zum Erstellen</p>
            }
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="p-4 border border-dashed border-[#1e4040] hover:border-[#3a7070] text-[#3a7070] hover:text-[#2a6060] text-[13px] uppercase tracking-[0.3em] transition-all"
          >
            + Neues Projekt
          </button>
        )}
      </div>
    </div>
  )
}

// ── Project Detail (Kanban + optional Calendar) ────────────────────────────
function ProjectDetail({ project, onBack }) {
  const [areas, setAreas]     = useState([])
  const [calOpen, setCalOpen] = useState(false)
  const [newArea, setNewArea] = useState('')

  const loadAreas = useCallback(async () => {
    const a = await api.getAreas(project.id)
    setAreas(a)
  }, [project.id])

  useEffect(() => { loadAreas() }, [loadAreas])

  const sortWps = (wps) => [...wps].sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1
    if (a.status !== 'done' && b.status === 'done') return -1
    return 0
  })

  const handleToggleDone = async (wpId, isDone) => {
    const newStatus = isDone ? 'todo' : 'done'
    setAreas(prev => prev.map(a => ({
      ...a,
      work_packages: sortWps(
        a.work_packages.map(wp => wp.id === wpId ? { ...wp, status: newStatus } : wp)
      ),
    })))
    api.updatePackage(wpId, { status: newStatus }).catch(() => loadAreas())
  }

  const handleDeleteWp = async (wpId) => {
    setAreas(prev => prev.map(a => ({
      ...a,
      work_packages: a.work_packages.filter(wp => wp.id !== wpId),
    })))
    api.deletePackage(wpId).catch(() => loadAreas())
  }

  const handleDeleteArea = async (areaId) => {
    setAreas(prev => prev.filter(a => a.id !== areaId))
    api.deleteArea(areaId).catch(() => loadAreas())
  }

  const handleAddWp = async (areaId, data) => {
    const wp = await api.createPackage(areaId, data)
    setAreas(prev => prev.map(a =>
      a.id === areaId ? { ...a, work_packages: [...a.work_packages, wp] } : a
    ))
  }

  const handleAddArea = async (e) => {
    if (e.key !== 'Enter' || !newArea.trim()) return
    const area = await api.createArea(project.id, { name: newArea.trim() })
    setAreas(prev => [...prev, area])
    setNewArea('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1e4040] flex-shrink-0">
        <button
          onClick={onBack}
          className="text-[#2a6060] hover:text-[#5aacac] text-[14px] uppercase tracking-[0.2em] transition-colors"
        >‹ Projekte</button>
        <span className="text-[#1e4040]">|</span>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
        <span className="text-[15px] uppercase tracking-[0.2em] text-[#5aacac]">{project.name}</span>
        {project.description && (
          <span className="text-[13px] text-[#3a7070]">── {project.description}</span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setCalOpen(v => !v)}
          className={`text-[13px] uppercase tracking-[0.2em] px-3 py-1 border transition-colors ${
            calOpen
              ? 'border-[#00a0a0] text-[#00cccc]'
              : 'border-[#1e4040] text-[#2a6060] hover:border-[#3a7070] hover:text-[#5aacac]'
          }`}
        >
          {calOpen ? '✕ Kalender' : '◷ Kalender'}
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 h-full">

        {/* Kanban */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden flex min-h-0 h-full">
          {areas.length === 0 ? (
            <div className="flex items-center justify-center flex-1">
              <p className="text-[14px] uppercase tracking-[0.3em] text-[#3a7070]">Noch keine Spalten</p>
            </div>
          ) : (
            areas.map(area => (
              <KanbanColumn
                key={area.id}
                area={area}
                projectColor={project.color}
                onToggleDone={handleToggleDone}
                onDeleteWp={handleDeleteWp}
                onDeleteArea={handleDeleteArea}
                onAddWp={handleAddWp}
              />
            ))
          )}

          {/* Add column */}
          <div className="flex-shrink-0 w-[220px] p-3 flex flex-col justify-start">
            <input
              value={newArea}
              onChange={e => setNewArea(e.target.value)}
              onKeyDown={handleAddArea}
              placeholder="+ Neue Spalte"
              className="bg-transparent text-[14px] text-[#2a6060] placeholder-[#3a7070] focus:outline-none px-2 py-1.5 border border-transparent focus:border-[#3a7070] transition-colors"
            />
          </div>
        </div>

        {/* Calendar panel */}
        {calOpen && (
          <CalendarPanel
            onClose={() => setCalOpen(false)}
            onDropItem={(wp, start, end) => api.createCalendarEvent({
              title: wp.title,
              start_time: start.toISOString(),
              end_time: end.toISOString(),
              color: wp.color || '#00a0a0',
              work_package_id: wp.id,
            })}
          />
        )}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export function Projects() {
  const [projects, setProjects]       = useState([])
  const [selectedProject, setSelected] = useState(null)

  useEffect(() => {
    api.getProjects().then(setProjects).catch(() => {})
  }, [])

  const handleAdd = async (data) => {
    const p = await api.createProject(data)
    if (p) setProjects(prev => [...prev, p])
  }

  const handleDelete = async (id) => {
    await api.deleteProject(id)
    setProjects(prev => prev.filter(p => p.id !== id))
    if (selectedProject?.id === id) setSelected(null)
  }

  return (
    <AppShell app="projects" label="Projekte">
      {selectedProject ? (
        <ProjectDetail
          project={selectedProject}
          onBack={() => setSelected(null)}
        />
      ) : (
        <ProjectGrid
          projects={projects}
          onSelect={setSelected}
          onAdd={handleAdd}
          onDelete={handleDelete}
        />
      )}
    </AppShell>
  )
}
