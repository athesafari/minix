import React, { useEffect, useState } from 'react'
import { Login } from './components/Login'
import { Composer } from './components/Composer'
import { Feed } from './components/Feed'
import { DirectMessages } from './components/DirectMessages'

type User = { id: string; username: string }

export default function App() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('currentUser') : null
    if (!stored) return
    try {
      const parsed = JSON.parse(stored) as User
      if (parsed?.id && parsed?.username) setUser(parsed)
    } catch {
      window.localStorage.removeItem('currentUser')
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (user) {
      window.localStorage.setItem('currentUser', JSON.stringify(user))
    } else {
      window.localStorage.removeItem('currentUser')
    }
  }, [user])

  async function handleLogin(username: string) {
    const r = await fetch('/api/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username })
    })
    const data = await r.json()
    if (data?.user) setUser(data.user)
  }

  function handleSwitch() {
    setUser(null)
  }

  return (
    <div className="app">
      <div className="nav">
        <div className="logo">miniX</div>
        <div className="nav-user">
          {user ? (
            <>
              <span>@{user.username}</span>
              <button className="btn-link small" onClick={handleSwitch}>Switch</button>
            </>
          ) : (
            <span>guest</span>
          )}
        </div>
      </div>
      <div className="card">
        {user ? <Composer user={user} /> : <Login onLogin={handleLogin} />}
      </div>
      <div className="card">
        <Feed currentUser={user} />
      </div>
      <div className="card">
        <DirectMessages currentUser={user} />
      </div>
    </div>
  )
}
