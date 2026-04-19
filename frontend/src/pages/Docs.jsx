import { useState, useEffect, useCallback, useRef } from 'react'
import { AppShell } from '../components/AppShell'
import { api } from '../api/client'

export function Docs() {
  const [projects, setProjects]         = useState([])
  const [selected, setSelected]         = useState(null)
  const [files, setFiles]               = useState([])
  const [openFile, setOpenFile]         = useState(null)
  const [editorContent, setEditor]      = useState('')
  const [dirty, setDirty]               = useState(false)
  const [pdfUrl, setPdfUrl]             = useState(null)
  const [compiling, setCompiling]       = useState(false)
  const [compileLog, setCompileLog]     = useState('')
  const [showLog, setShowLog]           = useState(false)
  const [newProjectName, setNewProject] = useState('')
  const [creating, setCreating]         = useState(false)
  const [newFileName, setNewFileName]   = useState('')
  const [addingType, setAddingType]     = useState(null) // 'file' | 'folder' | null
  const [editorWidth, setEditorWidth]   = useState(50)
  const [draggingDivider, setDragging]  = useState(false)
  const editorRef      = useRef(null)
  const containerRef   = useRef(null)
  const saveTimerRef   = useRef(null)
  // Refs so cleanup closures always read the latest values
  const openFileRef    = useRef(null)
  const editorRef2     = useRef('')
  const dirtyRef       = useRef(false)
  useEffect(() => { openFileRef.current  = openFile },      [openFile])
  useEffect(() => { editorRef2.current   = editorContent }, [editorContent])
  useEffect(() => { dirtyRef.current     = dirty },         [dirty])

  useEffect(() => {
    api.getDocProjects().then(setProjects).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selected) return
    // Cleanup: runs with OLD `selected` in closure when project switches or component unmounts
    return () => {
      clearTimeout(saveTimerRef.current)
      if (dirtyRef.current && openFileRef.current) {
        api.writeDocFile(selected, openFileRef.current.path, editorRef2.current).catch(() => {})
      }
    }
  }, [selected])

  useEffect(() => {
    if (!selected) return
    api.getDocFiles(selected).then(data => {
      const hidden = ['.aux', '.log', '.pdf', '.toc', '.out', '.fls', '.fdb_latexmk', '.synctex.gz']
      setFiles(data.filter(f => !f.is_dir && !hidden.some(ext => f.name.endsWith(ext))))
      setOpenFile(null)
      setEditor('')
      setDirty(false)
      setPdfUrl(null)
    }).catch(() => {})
  }, [selected])

  const openFileHandler = async (file) => {
    if (dirty && openFile) {
      clearTimeout(saveTimerRef.current)
      await save(editorContent)
    }
    const { content } = await api.readDocFile(selected, file.path)
    setOpenFile(file)
    setEditor(content)
    setDirty(false)
  }

  const save = useCallback(async (content) => {
    if (!openFile) return
    await api.writeDocFile(selected, openFile.path, content ?? editorContent)
    setDirty(false)
  }, [openFile, selected, editorContent])

  const onDividerMouseDown = (e) => {
    e.preventDefault()
    if (!containerRef.current || !editorRef.current) return
    const startX        = e.clientX
    const startWidth    = editorRef.current.getBoundingClientRect().width
    const containerRect = containerRef.current.getBoundingClientRect()
    const totalWidth    = containerRect.width

    const calc = (clientX) => {
      const delta = clientX - startX
      return Math.min(85, Math.max(10, ((startWidth + delta) / totalWidth) * 100))
    }

    setDragging(true)
    const onMove = (e) => {
      editorRef.current.style.width = `${calc(e.clientX)}%`
    }
    const onUp = (e) => {
      setDragging(false)
      setEditorWidth(calc(e.clientX))
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const createFile = async (e) => {
    if (e.key !== 'Enter' || !newFileName.trim()) return
    const name = newFileName.trim()
    const isDir = addingType === 'folder'
    if (isDir) {
      await api.writeDocFile(selected, name + '/.gitkeep', '')
    } else {
      await api.writeDocFile(selected, name, '')
    }
    const data = await api.getDocFiles(selected)
    const hidden = ['.aux', '.log', '.pdf', '.toc', '.out', '.fls', '.fdb_latexmk', '.synctex.gz', '.gitkeep']
    setFiles(data.filter(f => !f.is_dir && !hidden.some(ext => f.name.endsWith(ext))))
    setNewFileName('')
    setAddingType(null)
    if (!isDir) {
      const newFile = { name: name.split('/').pop(), path: name }
      openFileHandler(newFile)
    }
  }

  const deleteFile = async (file, e) => {
    e.stopPropagation()
    await api.deleteDocFile(selected, file.path)
    if (openFile?.path === file.path) { setOpenFile(null); setEditor('') }
    setFiles(prev => prev.filter(f => f.path !== file.path))
  }

  const handleEditorChange = (e) => {
    const val = e.target.value
    setEditor(val)
    setDirty(true)
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => save(val), 800)
  }

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      clearTimeout(saveTimerRef.current)
      save(editorContent)
    }
  }

  const compile = async () => {
    if (dirty) await save()
    setCompiling(true)
    setShowLog(false)
    try {
      const result = await api.compileDoc(selected)
      setCompileLog(result.log)
      if (result.success) {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl)
        const url = await api.getDocPdf(selected)
        setPdfUrl(url)
      } else {
        setShowLog(true)
      }
    } finally {
      setCompiling(false)
    }
  }

  const createProject = async (e) => {
    if (e.key !== 'Enter' || !newProjectName.trim()) return
    setCreating(true)
    try {
      const p = await api.createDocProject(newProjectName.trim())
      setProjects(prev => [...prev, p])
      setNewProject('')
      setSelected(p.name)
    } finally {
      setCreating(false)
    }
  }

  const deleteProject = async (name) => {
    if (!confirm(`Projekt "${name}" wirklich löschen?`)) return
    await api.deleteDocProject(name)
    setProjects(prev => prev.filter(p => p.name !== name))
    if (selected === name) setSelected(null)
  }

  if (!selected) {
    return (
      <AppShell app="docs" label="Dokumente">
        <div className="flex-1 flex flex-col p-8 max-w-2xl mx-auto w-full">
          <h2 className="text-[13px] uppercase tracking-[0.4em] text-[#3a7070] mb-6">LaTeX Projekte</h2>
          <div className="space-y-1 mb-6">
            {projects.map(p => (
              <div
                key={p.name}
                className="group flex items-center justify-between px-4 py-3 border border-[#1e4040] hover:border-[#3a7070] bg-[#080e0e] hover:bg-[#0d1e1e] transition-all cursor-pointer"
                onClick={() => setSelected(p.name)}
              >
                <span className="text-[16px] text-[#5aacac]">{p.name}</span>
                <button
                  onClick={e => { e.stopPropagation(); deleteProject(p.name) }}
                  className="opacity-0 group-hover:opacity-100 text-[#3a7070] hover:text-[#cc2222] text-[13px] transition-all"
                >✕</button>
              </div>
            ))}
            {projects.length === 0 && (
              <p className="text-[14px] text-[#3a7070]">Noch keine Projekte.</p>
            )}
          </div>
          <input
            value={newProjectName}
            onChange={e => setNewProject(e.target.value)}
            onKeyDown={createProject}
            placeholder="Neues Projekt (Enter)"
            disabled={creating}
            className="w-full bg-transparent border border-[#1e4040] focus:border-[#3a7070] px-3 py-2 text-[15px] text-[#5aacac] placeholder-[#3a7070] focus:outline-none transition-colors"
          />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      app="docs"
      extraContext={selected ? `Aktuell geöffnetes Projekt: "${selected}"` : null}
      onAiResponse={async () => {
        // Reload file list
        const data = await api.getDocFiles(selected)
        const hidden = ['.aux', '.log', '.pdf', '.toc', '.out', '.fls', '.fdb_latexmk', '.synctex.gz', '.gitkeep']
        const newFiles = data.filter(f => !f.is_dir && !hidden.some(ext => f.name.endsWith(ext)))
        setFiles(newFiles)
        // Reload open file if it still exists
        if (openFile) {
          const still = newFiles.find(f => f.path === openFile.path)
          if (still) {
            const { content } = await api.readDocFile(selected, openFile.path)
            setEditor(content)
            setDirty(false)
          }
        }
        // Recompile
        setCompiling(true)
        try {
          const result = await api.compileDoc(selected)
          setCompileLog(result.log)
          if (result.success) {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl)
            const url = await api.getDocPdf(selected)
            setPdfUrl(url)
          }
        } finally {
          setCompiling(false)
        }
      }}
    >
      <div className="flex-1 flex flex-col min-h-0">

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1e4040] flex-shrink-0">
          <button
            onClick={() => setSelected(null)}
            className="text-[13px] text-[#3a7070] hover:text-[#5aacac] uppercase tracking-[0.2em] transition-colors"
          >‹ Projekte</button>
          <span className="text-[#1e4040]">|</span>
          <span className="text-[14px] text-[#5aacac] uppercase tracking-[0.2em]">{selected}</span>
          <div className="flex-1" />
          {dirty && (
            <span className="text-[12px] text-[#3a7070] uppercase tracking-[0.2em]">···</span>
          )}
          <button
            onClick={compile}
            disabled={compiling || !selected}
            className="text-[13px] uppercase tracking-[0.2em] border border-[#00a0a0] text-[#00a0a0] hover:text-[#00cccc] px-3 py-0.5 transition-colors disabled:opacity-40"
          >{compiling ? '···' : 'Recompile'}</button>
          {compileLog && (
            <button
              onClick={() => setShowLog(v => !v)}
              className={`text-[13px] uppercase tracking-[0.2em] border px-2 py-0.5 transition-colors ${
                showLog ? 'border-[#00a0a0] text-[#00a0a0]' : 'border-[#3a7070] text-[#4a9090]'
              }`}
            >Log</button>
          )}
        </div>

        {/* Compile log */}
        {showLog && (
          <div className="bg-[#080e0e] border-b border-[#1e4040] px-4 py-2 flex-shrink-0 max-h-40 overflow-y-auto">
            <pre className="text-[12px] text-[#cc4444] font-mono whitespace-pre-wrap">{compileLog}</pre>
          </div>
        )}

        {/* Three panels */}
        <div ref={containerRef} className="flex-1 flex min-h-0">

          {/* File tree */}
          <div className="w-[180px] flex-shrink-0 border-r border-[#1e4040] flex flex-col bg-[#080e0e]">
            <div className="px-3 py-2 border-b border-[#1e4040] flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#3a7070]">Dateien</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setAddingType('file'); setNewFileName('') }}
                  className="text-[#3a7070] hover:text-[#00a0a0] text-[16px] leading-none transition-colors"
                  title="Neue Datei"
                >+</button>
                <button
                  onClick={() => { setAddingType('folder'); setNewFileName('') }}
                  className="text-[#3a7070] hover:text-[#00a0a0] text-[13px] leading-none transition-colors"
                  title="Neuer Ordner"
                >⊕</button>
              </div>
            </div>
            {addingType && (
              <div className="border-b border-[#1e4040] px-2 py-2 flex-shrink-0">
                <input
                  autoFocus
                  value={newFileName}
                  onChange={e => setNewFileName(e.target.value)}
                  onKeyDown={createFile}
                  onBlur={() => { setAddingType(null); setNewFileName('') }}
                  placeholder={addingType === 'folder' ? 'ordnername' : 'datei.tex'}
                  className="w-full bg-transparent border border-[#3a7070] focus:border-[#00a0a0] px-2 py-1 text-[12px] text-[#5aacac] placeholder-[#3a7070] focus:outline-none transition-colors"
                />
              </div>
            )}
            <div className="flex-1 overflow-y-auto py-1 no-scrollbar">
              {files.map(f => (
                <div key={f.path} className="group flex items-center">
                  <button
                    onClick={() => openFileHandler(f)}
                    className={`flex-1 text-left px-3 py-1.5 text-[13px] truncate transition-colors ${
                      openFile?.path === f.path
                        ? 'text-[#00cccc] bg-[#0d1e1e]'
                        : 'text-[#4a9090] hover:text-[#5aacac] hover:bg-[#0d1e1e]'
                    }`}
                    title={f.path}
                  >{f.path.includes('/') ? '  ' + f.name : f.name}</button>
                  <button
                    onClick={(e) => deleteFile(f, e)}
                    className="opacity-0 group-hover:opacity-100 pr-2 text-[#3a7070] hover:text-[#cc2222] text-[11px] transition-all flex-shrink-0"
                  >✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div ref={editorRef} className="flex flex-col min-w-0" style={{ width: `${editorWidth}%` }}>
            {openFile ? (
              <textarea
                value={editorContent}
                onChange={handleEditorChange}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                className="flex-1 resize-none bg-[#050909] text-[14px] text-[#5aacac] font-mono leading-relaxed px-4 py-3 focus:outline-none no-scrollbar"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[13px] text-[#3a7070] uppercase tracking-[0.3em]">Datei auswählen</p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div
            onMouseDown={onDividerMouseDown}
            className="w-3 flex-shrink-0 flex items-center justify-center cursor-col-resize group select-none bg-transparent"
          >
            <div className="w-1 h-full bg-[#1e4040] group-hover:bg-[#3a7070] transition-colors absolute" />
            <div className="relative z-10 flex flex-col gap-[3px] items-center justify-center w-3 h-8 bg-[#0d1e1e] border border-[#3a7070] group-hover:border-[#00a0a0] transition-colors rounded-sm">
              <div className="w-[2px] h-[2px] rounded-full bg-[#3a7070] group-hover:bg-[#00a0a0] transition-colors" />
              <div className="w-[2px] h-[2px] rounded-full bg-[#3a7070] group-hover:bg-[#00a0a0] transition-colors" />
              <div className="w-[2px] h-[2px] rounded-full bg-[#3a7070] group-hover:bg-[#00a0a0] transition-colors" />
            </div>
          </div>

          {/* PDF preview */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#080e0e] relative">
            {draggingDivider && (
              <div className="absolute inset-0 z-50 cursor-col-resize" />
            )}
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="flex-1 w-full border-0"
                title="PDF Preview"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[13px] text-[#3a7070] uppercase tracking-[0.3em]">
                  {compiling ? 'Kompiliere···' : 'Recompile drücken'}
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </AppShell>
  )
}
