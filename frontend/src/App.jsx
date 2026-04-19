import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { api } from './api/client'
import { Home } from './pages/Home'
import { Calendar } from './pages/Calendar'
import { Projects } from './pages/Projects'
import { Docs } from './pages/Docs'
import { Fitness } from './pages/Fitness'
import { Calories } from './pages/Calories'
import { Stocks } from './pages/Stocks'

function Login({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(false)
    try {
      const { token } = await api.login(password)
      localStorage.setItem('token', token)
      onLogin()
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050909] flex items-center justify-center">
      <div className="border border-[#3a7070] p-8 w-72">
        <div className="mb-8 text-center">
          <p className="text-[13px] uppercase tracking-[0.6em] text-[#3a7070] mb-1">── personal ──</p>
          <h1 className="text-[18px] uppercase tracking-[0.5em] text-[#00a0a0]">LIFE OS</h1>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="passwort"
            autoFocus
            className="w-full bg-transparent border border-[#3a7070] px-3 py-2 text-[16px] text-[#00cccc] placeholder-[#2a6060] focus:outline-none focus:border-[#2a6060] mb-4 font-mono"
          />
          {error && (
            <p className="text-[#cc2222] text-[13px] uppercase tracking-widest mb-3">falsches passwort</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full border border-[#3a7070] hover:border-[#2a6060] text-[#5aacac] hover:text-[#00cccc] py-2 text-[14px] uppercase tracking-[0.25em] transition-colors disabled:opacity-40"
          >
            {loading ? '···' : 'Einloggen'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('token'))

  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Home />} />
        <Route path="/calendar"  element={<Calendar />} />
        <Route path="/projects"  element={<Projects />} />
        <Route path="/docs"      element={<Docs />} />
        <Route path="/fitness"   element={<Fitness />} />
        <Route path="/calories"  element={<Calories />} />
        <Route path="/stocks"    element={<Stocks />} />
        <Route path="*"          element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
