import { useState, useEffect, useCallback } from 'react'
import { AppShell } from '../components/AppShell'
import { CalendarPanel } from '../components/CalendarPanel'
import { api } from '../api/client'

// ── Types & Colors ─────────────────────────────────────────────────────────

const WORKOUT_TYPES = [
  { id: 'strength', label: 'Kraft',   color: '#c05050' },
  { id: 'cardio',   label: 'Cardio',  color: '#00a0a0' },
  { id: 'stretch',  label: 'Dehnen',  color: '#50a070' },
  { id: 'mixed',    label: 'Gemischt',color: '#8050c0' },
]

const WORKOUT_COLORS = [
  '#c05050', '#00a0a0', '#5080c0', '#c07030',
  '#50a070', '#a050c0', '#c0a030', '#50a0c0',
]

const DAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const DAYS_FULL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

function typeLabel(type) {
  return WORKOUT_TYPES.find(t => t.id === type)?.label ?? type
}

function typeColor(type) {
  return WORKOUT_TYPES.find(t => t.id === type)?.color ?? '#00a0a0'
}

// ── Exercise Row ───────────────────────────────────────────────────────────

function ExerciseRow({ ex, workoutType, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [vals, setVals] = useState({
    name: ex.name, sets: ex.sets ?? '', reps: ex.reps ?? '',
    weight_kg: ex.weight_kg ?? '', duration_min: ex.duration_min ?? '', distance_km: ex.distance_km ?? '',
    notes: ex.notes ?? '',
  })

  const save = async () => {
    await onUpdate(ex.id, {
      name: vals.name,
      sets: vals.sets !== '' ? parseInt(vals.sets) : null,
      reps: vals.reps || null,
      weight_kg: vals.weight_kg !== '' ? parseFloat(vals.weight_kg) : null,
      duration_min: vals.duration_min !== '' ? parseFloat(vals.duration_min) : null,
      distance_km: vals.distance_km !== '' ? parseFloat(vals.distance_km) : null,
      notes: vals.notes || null,
    })
    setEditing(false)
  }

  const isStrength = workoutType === 'strength' || workoutType === 'mixed'
  const isCardio   = workoutType === 'cardio'   || workoutType === 'mixed'
  const isStretch  = workoutType === 'stretch'  || workoutType === 'mixed'

  if (editing) {
    return (
      <div className="py-3 px-4 border-t border-[#1a3030] space-y-3">
        <input
          autoFocus
          value={vals.name}
          onChange={e => setVals(p => ({ ...p, name: e.target.value }))}
          className="w-full bg-transparent border-b border-[#3a7070] text-[15px] text-[#00cccc] focus:outline-none pb-1"
        />
        <div className="flex flex-wrap gap-3">
          {isStrength && (
            <>
              <Field label="Sätze"  val={vals.sets}      setVal={v => setVals(p => ({ ...p, sets: v }))}      w="w-16" />
              <Field label="Wdh"    val={vals.reps}      setVal={v => setVals(p => ({ ...p, reps: v }))}      w="w-20" type="text" placeholder="8-12" />
              <Field label="kg"     val={vals.weight_kg} setVal={v => setVals(p => ({ ...p, weight_kg: v }))} w="w-20" />
            </>
          )}
          {isCardio && (
            <>
              <Field label="Min"    val={vals.duration_min} setVal={v => setVals(p => ({ ...p, duration_min: v }))} w="w-20" />
              <Field label="km"     val={vals.distance_km}  setVal={v => setVals(p => ({ ...p, distance_km: v }))}  w="w-20" />
            </>
          )}
          {isStretch && !isCardio && (
            <Field label="Min"    val={vals.duration_min} setVal={v => setVals(p => ({ ...p, duration_min: v }))} w="w-20" />
          )}
        </div>
        <input
          value={vals.notes}
          onChange={e => setVals(p => ({ ...p, notes: e.target.value }))}
          placeholder="Notizen..."
          className="w-full bg-transparent text-[14px] text-[#3a7070] focus:outline-none"
        />
        <div className="flex gap-2">
          <button onClick={save} className="text-[13px] uppercase tracking-wider border border-[#00a0a0] text-[#00a0a0] px-3 py-1 hover:text-[#00cccc] transition-colors">OK</button>
          <button onClick={() => setEditing(false)} className="text-[13px] text-[#3a7070] hover:text-[#5aacac] transition-colors">Abbrechen</button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="group flex items-center gap-2 py-2.5 px-4 border-t border-[#1a3030] hover:bg-[#0d1e1e] cursor-pointer transition-colors"
      onClick={() => setEditing(true)}
    >
      <div className="flex-1 min-w-0">
        <span className="text-[15px] text-[#5aacac]">{ex.name}</span>
        <span className="text-[13px] text-[#3a6060] ml-2">
          {[
            ex.sets && ex.reps ? `${ex.sets}×${ex.reps}` : ex.sets ? `${ex.sets} Sätze` : null,
            ex.weight_kg ? `${ex.weight_kg}kg` : null,
            ex.duration_min ? `${ex.duration_min}min` : null,
            ex.distance_km ? `${ex.distance_km}km` : null,
          ].filter(Boolean).join(' · ')}
        </span>
        {ex.notes && <span className="text-[12px] text-[#2a5050] ml-2 italic">{ex.notes}</span>}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete(ex.id) }}
        className="opacity-0 group-hover:opacity-100 text-[13px] text-[#2a4040] hover:text-[#e05a5a] transition-all flex-shrink-0"
      >✕</button>
    </div>
  )
}

function Field({ label, val, setVal, w = 'w-20', type = 'number', placeholder }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] text-[#3a7070] uppercase tracking-wider">{label}</span>
      <input
        type={type}
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder={placeholder}
        className={`${w} bg-transparent border border-[#3a7070] px-2 py-1 text-[14px] text-[#00cccc] focus:outline-none focus:border-[#00a0a0] text-center`}
      />
    </div>
  )
}

// ── Workout Card ───────────────────────────────────────────────────────────

function WorkoutCard({ workout, onDelete, onUpdate, onAddExercise, onDeleteExercise, onUpdateExercise }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing]   = useState(false)
  const [addingEx, setAddingEx] = useState(false)
  const [exName, setExName]     = useState('')
  const [vals, setVals] = useState({
    name: workout.name, type: workout.type, color: workout.color,
    duration_min: workout.duration_min, preferred_day: workout.preferred_day ?? '',
  })

  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: workout.id,
      title: workout.name,
      estimated_hours: (workout.duration_min || 60) / 60,
      color: workout.color || '#00a0a0',
      isWorkout: true,
    }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const saveEdit = async () => {
    await onUpdate(workout.id, {
      name: vals.name,
      type: vals.type,
      color: vals.color,
      duration_min: parseInt(vals.duration_min) || 60,
      preferred_day: vals.preferred_day !== '' ? parseInt(vals.preferred_day) : null,
    })
    setEditing(false)
  }

  const addExercise = async () => {
    if (!exName.trim()) return
    await onAddExercise(workout.id, { name: exName.trim() })
    setExName('')
    setAddingEx(false)
  }

  const tc = typeColor(workout.type)

  return (
    <div
      className="border border-[#1e4040] bg-[#080e0e] overflow-hidden"
      style={{ borderLeftWidth: 3, borderLeftColor: workout.color || '#00a0a0' }}
    >
      {/* Header row */}
      {editing ? (
        <div className="p-4 space-y-3">
          <input
            autoFocus
            value={vals.name}
            onChange={e => setVals(p => ({ ...p, name: e.target.value }))}
            className="w-full bg-transparent border-b border-[#3a7070] text-[16px] text-[#00cccc] focus:outline-none pb-1"
          />
          <div className="flex flex-wrap gap-3 items-end">
            {/* Type */}
            <div>
              <div className="text-[12px] text-[#3a7070] uppercase tracking-wider mb-1">Typ</div>
              <div className="flex gap-1">
                {WORKOUT_TYPES.map(t => (
                  <button key={t.id} onClick={() => setVals(p => ({ ...p, type: t.id }))}
                    className="text-[13px] px-2.5 py-1 border transition-colors"
                    style={{
                      borderColor: vals.type === t.id ? t.color : t.color + '50',
                      color: vals.type === t.id ? t.color : t.color + '90',
                      background: vals.type === t.id ? t.color + '20' : 'transparent',
                    }}
                  >{t.label}</button>
                ))}
              </div>
            </div>
            {/* Duration */}
            <div>
              <div className="text-[12px] text-[#3a7070] uppercase tracking-wider mb-1">Min</div>
              <input type="number" value={vals.duration_min}
                onChange={e => setVals(p => ({ ...p, duration_min: e.target.value }))}
                className="w-16 bg-transparent border border-[#3a7070] px-2 py-1 text-[14px] text-[#00cccc] focus:outline-none focus:border-[#00a0a0] text-center"
              />
            </div>
            {/* Preferred day */}
            <div>
              <div className="text-[12px] text-[#3a7070] uppercase tracking-wider mb-1">Tag</div>
              <select value={vals.preferred_day}
                onChange={e => setVals(p => ({ ...p, preferred_day: e.target.value }))}
                className="bg-[#0d1e1e] border border-[#3a7070] px-2 py-1 text-[14px] text-[#5aacac] focus:outline-none"
              >
                <option value="">—</option>
                {DAYS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            {/* Color */}
            <div>
              <div className="text-[12px] text-[#3a7070] uppercase tracking-wider mb-1">Farbe</div>
              <div className="flex gap-1.5 flex-wrap max-w-[140px]">
                {WORKOUT_COLORS.map(c => (
                  <button key={c} onClick={() => setVals(p => ({ ...p, color: c }))}
                    className="w-5 h-5 rounded-full transition-all"
                    style={{ backgroundColor: c, outline: vals.color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveEdit} className="text-[13px] uppercase tracking-wider border border-[#00a0a0] text-[#00a0a0] px-3 py-1 hover:text-[#00cccc] transition-colors">Speichern</button>
            <button onClick={() => setEditing(false)} className="text-[13px] text-[#3a7070] hover:text-[#5aacac] transition-colors">Abbrechen</button>
          </div>
        </div>
      ) : (
        <div
          className="group flex items-center gap-3 px-4 py-3 cursor-grab active:cursor-grabbing hover:bg-[#0d1e1e] transition-colors"
          draggable
          onDragStart={handleDragStart}
          onClick={() => setExpanded(v => !v)}
        >
          <span className="text-[#3a6060] group-hover:text-[#5a8080] text-[18px] flex-shrink-0 cursor-grab">⠿</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[16px] text-[#5aacac] truncate">{workout.name}</span>
              <span className="text-[12px] px-1.5 py-0.5 border flex-shrink-0"
                style={{ borderColor: tc + '80', color: tc }}
              >{typeLabel(workout.type)}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[13px] text-[#3a6060]">{workout.duration_min} Min</span>
              {workout.preferred_day != null && (
                <span className="text-[13px] text-[#2a5050]">{DAYS_DE[workout.preferred_day]}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={e => { e.stopPropagation(); setEditing(true); setExpanded(true) }}
              onMouseDown={e => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 text-[13px] text-[#3a7070] hover:text-[#5aacac] transition-all"
            >✎</button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(workout.id) }}
              onMouseDown={e => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 text-[13px] text-[#2a4040] hover:text-[#e05a5a] transition-all"
            >✕</button>
            <button
              onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
              onMouseDown={e => e.stopPropagation()}
              className="text-[14px] text-[#2a5050] hover:text-[#5aacac] transition-colors ml-1"
            >{expanded ? '▲' : '▼'}</button>
          </div>
        </div>
      )}

      {/* Exercises */}
      {expanded && !editing && (
        <>
          {workout.exercises.length === 0 && (
            <div className="px-4 py-2.5 border-t border-[#1a3030]">
              <span className="text-[14px] text-[#2a4a4a]">Keine Übungen</span>
            </div>
          )}
          {workout.exercises.map(ex => (
            <ExerciseRow
              key={ex.id}
              ex={ex}
              workoutType={workout.type}
              onDelete={onDeleteExercise}
              onUpdate={onUpdateExercise}
            />
          ))}
          {addingEx ? (
            <div className="flex items-center gap-2 px-4 py-2.5 border-t border-[#1a3030]">
              <input
                autoFocus
                value={exName}
                onChange={e => setExName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addExercise(); if (e.key === 'Escape') setAddingEx(false) }}
                placeholder="Übungsname..."
                className="flex-1 bg-transparent text-[15px] text-[#00cccc] placeholder-[#3a7070] focus:outline-none"
              />
              <button onClick={addExercise} className="text-[14px] border border-[#00a0a0] text-[#00a0a0] px-2.5 py-1 hover:text-[#00cccc] transition-colors">+</button>
              <button onClick={() => setAddingEx(false)} className="text-[14px] text-[#3a7070]">✕</button>
            </div>
          ) : (
            <button
              onClick={() => setAddingEx(true)}
              className="w-full text-left px-4 py-2.5 border-t border-[#1a3030] text-[13px] text-[#2a5050] hover:text-[#00a0a0] uppercase tracking-wider transition-colors"
            >+ Übung</button>
          )}
        </>
      )}
    </div>
  )
}

// ── Create Workout Form ────────────────────────────────────────────────────

function CreateWorkoutForm({ onCreate, onCancel }) {
  const [name, setName]         = useState('')
  const [type, setType]         = useState('strength')
  const [color, setColor]       = useState('#c05050')
  const [duration, setDuration] = useState(60)
  const [prefDay, setPrefDay]   = useState('')

  const submit = async () => {
    if (!name.trim()) return
    await onCreate({
      name: name.trim(), type, color,
      duration_min: parseInt(duration) || 60,
      preferred_day: prefDay !== '' ? parseInt(prefDay) : null,
    })
  }

  return (
    <div className="border border-[#3a7070] bg-[#080e0e] p-5 space-y-4">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="Name des Workouts..."
        className="w-full bg-transparent border-b border-[#3a7070] text-[16px] text-[#00cccc] focus:outline-none pb-1"
      />
      <div className="flex flex-wrap gap-1.5">
        {WORKOUT_TYPES.map(t => (
          <button key={t.id} onClick={() => { setType(t.id); setColor(t.color) }}
            className="text-[13px] px-3 py-1 border transition-colors"
            style={{
              borderColor: type === t.id ? t.color : t.color + '50',
              color: type === t.id ? t.color : t.color + '90',
              background: type === t.id ? t.color + '20' : 'transparent',
            }}
          >{t.label}</button>
        ))}
      </div>
      <div className="flex gap-4 items-end flex-wrap">
        <div>
          <div className="text-[12px] text-[#3a7070] uppercase tracking-wider mb-1">Dauer (Min)</div>
          <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
            className="w-20 bg-transparent border border-[#3a7070] px-2 py-1.5 text-[14px] text-[#00cccc] focus:outline-none focus:border-[#00a0a0] text-center" />
        </div>
        <div>
          <div className="text-[12px] text-[#3a7070] uppercase tracking-wider mb-1">Bevorzugter Tag</div>
          <select value={prefDay} onChange={e => setPrefDay(e.target.value)}
            className="bg-[#0d1e1e] border border-[#3a7070] px-2 py-1.5 text-[14px] text-[#5aacac] focus:outline-none">
            <option value="">Kein</option>
            {DAYS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>
        <div>
          <div className="text-[12px] text-[#3a7070] uppercase tracking-wider mb-1">Farbe</div>
          <div className="flex gap-1.5 flex-wrap max-w-[140px]">
            {WORKOUT_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className="w-5 h-5 rounded-full transition-all"
                style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={submit}
          className="px-4 py-2 border border-[#00a0a0] text-[#00a0a0] text-[13px] uppercase tracking-[0.2em] hover:text-[#00cccc] transition-colors">
          Erstellen
        </button>
        <button onClick={onCancel} className="text-[13px] text-[#3a7070] hover:text-[#5aacac] transition-colors">Abbrechen</button>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export function Fitness() {
  const [workouts, setWorkouts] = useState([])
  const [calOpen, setCalOpen]   = useState(false)
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => api.getWorkouts().then(setWorkouts).catch(() => {}), [])
  useEffect(() => { load() }, [load])

  const handleCreate = async (data) => {
    await api.createWorkout(data)
    await load()
    setCreating(false)
  }

  const handleUpdate = async (id, data) => {
    await api.updateWorkout(id, data)
    await load()
  }

  const handleDelete = async (id) => {
    await api.deleteWorkout(id)
    setWorkouts(prev => prev.filter(w => w.id !== id))
  }

  const handleAddExercise = async (workoutId, data) => {
    await api.addWorkoutExercise(workoutId, data)
    await load()
  }

  const handleDeleteExercise = async (exId) => {
    await api.deleteWorkoutExercise(exId)
    await load()
  }

  const handleUpdateExercise = async (exId, data) => {
    await api.updateWorkoutExercise(exId, data)
    await load()
  }

  const extraContext = `${workouts.length} Workouts definiert.`

  return (
    <AppShell app="fitness" label="Fitness" extraContext={extraContext} onAiResponse={load}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1e4040] flex-shrink-0">
          <span className="text-[12px] text-[#3a7070] uppercase tracking-widest">{workouts.length} Workouts</span>
          <div className="flex-1" />
          <button
            onClick={() => setCalOpen(v => !v)}
            className={`text-[13px] uppercase tracking-[0.2em] px-3 py-1 border transition-colors ${
              calOpen
                ? 'border-[#00a0a0] text-[#00cccc]'
                : 'border-[#1e4040] text-[#2a6060] hover:border-[#3a7070] hover:text-[#5aacac]'
            }`}
          >{calOpen ? '✕ Kalender' : '◷ Kalender'}</button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
            {creating && (
              <CreateWorkoutForm onCreate={handleCreate} onCancel={() => setCreating(false)} />
            )}
            {workouts.map(w => (
              <WorkoutCard
                key={w.id}
                workout={w}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                onAddExercise={handleAddExercise}
                onDeleteExercise={handleDeleteExercise}
                onUpdateExercise={handleUpdateExercise}
              />
            ))}
            {workouts.length === 0 && !creating && (
              <div className="flex items-center justify-center h-48">
                <span className="text-[13px] text-[#2a4a4a] uppercase tracking-widest">Noch keine Workouts</span>
              </div>
            )}
            {!creating && (
              <button
                onClick={() => setCreating(true)}
                className="w-full py-3 border border-dashed border-[#1e4040] text-[13px] uppercase tracking-[0.3em] text-[#3a7070] hover:border-[#3a7070] hover:text-[#4a9090] transition-colors"
              >+ Workout erstellen</button>
            )}
          </div>

          {/* Calendar panel */}
          {calOpen && (
            <CalendarPanel
              onClose={() => setCalOpen(false)}
              onDropItem={(item, start, end) => api.createCalendarEvent({
                title: item.title,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                color: item.color || '#00a0a0',
              })}
            />
          )}
        </div>
      </div>
    </AppShell>
  )
}

