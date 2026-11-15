'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ── Types ────────────────────────────────────────────────────────────
interface Task {
  id: string
  title: string
  description: string | null
  column: string
  assignee: string | null
  priority: number
  position: number
}

const COLUMNS = [
  { id: 'backlog',  label: 'Backlog',      color: '#94a3b8', icon: '📋' },
  { id: 'week',     label: 'Esta semana',   color: '#3b82f6', icon: '📅' },
  { id: 'doing',    label: 'En curso',      color: '#f59e0b', icon: '🔥' },
  { id: 'done',     label: 'Hecho',         color: '#22c55e', icon: '✅' },
] as const

const PEOPLE = ['jaime', 'alfredo'] as const
type Person = typeof PEOPLE[number]

const AVATARS: Record<Person, { bg: string; letter: string }> = {
  jaime:  { bg: '#3b82f6', letter: 'J' },
  alfredo: { bg: '#f59e0b', letter: 'A' },
}

// ── API helpers ──────────────────────────────────────────────────────
async function api(method: string, body?: unknown) {
  const res = await fetch('/api/go', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return res.json()
}
async function apiReorder(moves: { id: string; column: string; position: number }[]) {
  return fetch('/api/go/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ moves }),
  })
}

// ── Login screen ─────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    setErr('')
    const d = await api('POST', { password: pw })
    setLoading(false)
    if (d.ok) onLogin()
    else setErr('Contraseña incorrecta')
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 360, background: '#1e293b', borderRadius: 16, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🚀</div>
        <h1 style={{ fontFamily: FONT, fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>QuieroComer Go</h1>
        <p style={{ fontFamily: FONT, fontSize: 14, color: '#94a3b8', margin: '0 0 24px' }}>Board interno del equipo</p>
        <input
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Contraseña"
          autoFocus
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 10, border: '2px solid #334155',
            background: '#0f172a', color: '#fff', fontSize: 15, fontFamily: FONT,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
        {err && <p style={{ color: '#ef4444', fontSize: 13, fontFamily: FONT, margin: '8px 0 0' }}>{err}</p>}
        <button
          onClick={submit}
          disabled={loading}
          style={{
            marginTop: 16, width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
            background: '#3b82f6', color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: FONT,
            cursor: 'pointer', opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </div>
  )
}

// ── Avatar chip ──────────────────────────────────────────────────────
function Avatar({ name, size = 22, onClick }: { name: string | null; size?: number; onClick?: () => void }) {
  if (!name) {
    return (
      <div
        onClick={onClick}
        style={{
          width: size, height: size, borderRadius: '50%', border: '2px dashed #475569',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: onClick ? 'pointer' : 'default',
          fontSize: size * 0.45, color: '#475569',
        }}
      >
        ?
      </div>
    )
  }
  const a = AVATARS[name as Person] || { bg: '#6b7280', letter: name[0].toUpperCase() }
  return (
    <div
      onClick={onClick}
      title={name.charAt(0).toUpperCase() + name.slice(1)}
      style={{
        width: size, height: size, borderRadius: '50%', background: a.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.48, fontWeight: 800, color: '#fff', fontFamily: FONT,
        cursor: onClick ? 'pointer' : 'default', flexShrink: 0,
      }}
    >
      {a.letter}
    </div>
  )
}

// ── Task card ────────────────────────────────────────────────────────
function TaskCard({
  task, onUpdate, onArchive, dragHandlers,
}: {
  task: Task
  onUpdate: (id: string, data: Partial<Task>) => void
  onArchive: (id: string) => void
  dragHandlers: {
    onDragStart: (e: React.DragEvent, task: Task) => void
    onDragEnd: () => void
  }
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const save = () => {
    if (title.trim()) onUpdate(task.id, { title: title.trim(), description: desc.trim() || null })
    setEditing(false)
  }

  const cycleAssignee = () => {
    const current = task.assignee
    const idx = current ? PEOPLE.indexOf(current as Person) : -1
    const next = idx === -1 ? PEOPLE[0] : idx === PEOPLE.length - 1 ? null : PEOPLE[idx + 1]
    onUpdate(task.id, { assignee: next })
  }

  const togglePriority = () => {
    onUpdate(task.id, { priority: task.priority === 1 ? 0 : 1 })
  }

  return (
    <div
      draggable
      onDragStart={e => dragHandlers.onDragStart(e, task)}
      onDragEnd={dragHandlers.onDragEnd}
      style={{
        background: '#1e293b', borderRadius: 10, padding: '10px 12px',
        border: task.priority === 1 ? '2px solid #f59e0b' : '1.5px solid #334155',
        cursor: 'grab', transition: 'box-shadow .15s, border-color .15s',
        userSelect: 'none',
      }}
      onDoubleClick={() => setEditing(true)}
    >
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            ref={inputRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            style={{
              background: '#0f172a', border: '1px solid #475569', borderRadius: 6,
              padding: '6px 8px', color: '#fff', fontSize: 13, fontFamily: FONT, outline: 'none',
            }}
          />
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Descripción (opcional)"
            rows={2}
            style={{
              background: '#0f172a', border: '1px solid #475569', borderRadius: 6,
              padding: '6px 8px', color: '#cbd5e1', fontSize: 12, fontFamily: FONT, outline: 'none',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(false)} style={{ ...btnSmall, background: '#334155' }}>Cancelar</button>
            <button onClick={save} style={{ ...btnSmall, background: '#3b82f6' }}>Guardar</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
            <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.35, flex: 1 }}>
              {task.priority === 1 && <span style={{ color: '#f59e0b', marginRight: 4 }}>⚡</span>}
              {task.title}
            </span>
            <Avatar name={task.assignee} size={20} onClick={cycleAssignee} />
          </div>
          {task.description && (
            <p style={{ fontFamily: FONT, fontSize: 11, color: '#94a3b8', margin: '4px 0 0', lineHeight: 1.4 }}>
              {task.description}
            </p>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
            <button onClick={togglePriority} title="Urgente" style={{ ...iconBtn, color: task.priority === 1 ? '#f59e0b' : '#475569' }}>⚡</button>
            <button onClick={() => onArchive(task.id)} title="Archivar" style={{ ...iconBtn, color: '#475569' }}>🗑</button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Column ───────────────────────────────────────────────────────────
function Column({
  col, tasks, onUpdate, onArchive, onAdd, dragState, setDragState,
}: {
  col: typeof COLUMNS[number]
  tasks: Task[]
  onUpdate: (id: string, data: Partial<Task>) => void
  onArchive: (id: string) => void
  onAdd: (column: string, title: string) => void
  dragState: DragState
  setDragState: (s: DragState) => void
}) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const isOver = dragState.overColumn === col.id

  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])

  const handleAdd = () => {
    if (newTitle.trim()) {
      onAdd(col.id, newTitle.trim())
      setNewTitle('')
    }
    setAdding(false)
  }

  const dragHandlers = {
    onDragStart: (e: React.DragEvent, task: Task) => {
      e.dataTransfer.effectAllowed = 'move'
      setDragState({ dragging: task, overColumn: null })
    },
    onDragEnd: () => setDragState({ dragging: null, overColumn: null }),
  }

  return (
    <div
      onDragOver={e => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (dragState.overColumn !== col.id) setDragState({ ...dragState, overColumn: col.id })
      }}
      onDragLeave={() => {
        if (dragState.overColumn === col.id) setDragState({ ...dragState, overColumn: null })
      }}
      onDrop={e => {
        e.preventDefault()
        if (dragState.dragging && dragState.dragging.column !== col.id) {
          onUpdate(dragState.dragging.id, { column: col.id, position: tasks.length })
        }
        setDragState({ dragging: null, overColumn: null })
      }}
      style={{
        flex: '1 1 280px', minWidth: 260, maxWidth: 380,
        background: isOver ? '#1a2744' : '#111827',
        borderRadius: 14, padding: '12px 10px', display: 'flex', flexDirection: 'column',
        border: isOver ? '2px dashed #3b82f6' : '2px solid transparent',
        transition: 'background .15s, border-color .15s',
        maxHeight: 'calc(100dvh - 90px)',
      }}
    >
      {/* Column header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 15 }}>{col.icon}</span>
          <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 800, color: col.color, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {col.label}
          </span>
          <span style={{
            fontFamily: FONT, fontSize: 11, fontWeight: 700, color: '#94a3b8',
            background: '#1e293b', borderRadius: 999, padding: '1px 7px', minWidth: 18, textAlign: 'center',
          }}>
            {tasks.length}
          </span>
        </div>
        <button onClick={() => setAdding(true)} style={{ ...iconBtn, fontSize: 16, color: '#64748b' }}>+</button>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 }}>
        {tasks.map(t => (
          <TaskCard key={t.id} task={t} onUpdate={onUpdate} onArchive={onArchive} dragHandlers={dragHandlers} />
        ))}

        {/* Inline add */}
        {adding && (
          <div style={{ background: '#1e293b', borderRadius: 10, padding: '8px 10px', border: '1.5px solid #3b82f6' }}>
            <input
              ref={inputRef}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewTitle('') } }}
              placeholder="Título de la tarea…"
              style={{
                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                color: '#fff', fontSize: 13, fontFamily: FONT, padding: 0, boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setAdding(false); setNewTitle('') }} style={{ ...btnSmall, background: '#334155' }}>Cancelar</button>
              <button onClick={handleAdd} style={{ ...btnSmall, background: '#3b82f6' }}>Agregar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────
const FONT = "'Inter', system-ui, -apple-system, sans-serif"
const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 13, lineHeight: 1,
}
const btnSmall: React.CSSProperties = {
  fontFamily: FONT, fontSize: 12, fontWeight: 600, color: '#fff',
  border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
}

type DragState = { dragging: Task | null; overColumn: string | null }

// ── Main board ───────────────────────────────────────────────────────
export default function GoBoard() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [dragState, setDragState] = useState<DragState>({ dragging: null, overColumn: null })
  const [filter, setFilter] = useState<string | null>(null) // null = all

  // Check auth on mount
  useEffect(() => {
    api('GET').then(d => {
      if (d.error) setAuthed(false)
      else { setAuthed(true); setTasks(d.tasks) }
    })
  }, [])

  const refresh = useCallback(async () => {
    const d = await api('GET')
    if (d.tasks) setTasks(d.tasks)
  }, [])

  const updateTask = async (id: string, data: Partial<Task>) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
    await api('PUT', { id, ...data })
  }

  const archiveTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    await fetch('/api/go', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  const addTask = async (column: string, title: string) => {
    const d = await api('PUT', { title, column })
    if (d.task) setTasks(prev => [...prev, d.task])
  }

  if (authed === null) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{ color: '#64748b', fontFamily: FONT, fontSize: 14 }}>Cargando…</div>
      </div>
    )
  }

  if (!authed) return <LoginScreen onLogin={() => { setAuthed(true); refresh() }} />

  const filtered = filter ? tasks.filter(t => t.assignee === filter) : tasks

  return (
    <div style={{ minHeight: '100dvh', background: '#0f172a', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #1e293b', flexShrink: 0, gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🚀</span>
          <span style={{ fontFamily: FONT, fontSize: 17, fontWeight: 800, color: '#fff' }}>Go</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Filter by person */}
          <button
            onClick={() => setFilter(null)}
            style={{
              ...btnSmall,
              background: filter === null ? '#334155' : 'transparent',
              color: filter === null ? '#fff' : '#64748b',
              padding: '4px 10px',
            }}
          >
            Todos
          </button>
          {PEOPLE.map(p => (
            <button
              key={p}
              onClick={() => setFilter(filter === p ? null : p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                ...btnSmall,
                background: filter === p ? '#334155' : 'transparent',
                color: filter === p ? '#fff' : '#64748b',
                padding: '4px 10px',
              }}
            >
              <Avatar name={p} size={16} />
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          <button onClick={refresh} title="Refrescar" style={{ ...iconBtn, color: '#64748b', fontSize: 16, marginLeft: 8 }}>🔄</button>
        </div>
      </div>

      {/* Board */}
      <div style={{
        flex: 1, display: 'flex', gap: 10, padding: '12px 12px 20px', overflowX: 'auto',
        alignItems: 'flex-start',
      }}>
        {COLUMNS.map(col => (
          <Column
            key={col.id}
            col={col}
            tasks={filtered.filter(t => t.column === col.id)}
            onUpdate={updateTask}
            onArchive={archiveTask}
            onAdd={addTask}
            dragState={dragState}
            setDragState={setDragState}
          />
        ))}
      </div>
    </div>
  )
}
