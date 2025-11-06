import React, { useEffect, useState } from 'react'
import { Login } from './components/Login'
import { Composer } from './components/Composer'
import { Feed } from './components/Feed'

type User = { id: string; username: string }

export default function App() {
  const [user, setUser] = useState<User | null>(null)

  async function handleLogin(username: string) {
    const r = await fetch('/api/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username })
    })
    const data = await r.json()
    setUser(data.user)
  }

  return (
    <div className="app">
      <div className="nav">
        <div className="logo">miniX</div>
        <div style={{marginLeft:'auto'}}>{user ? '@'+user.username : 'guest'}</div>
      </div>
      <div className="card">
        {user ? <Composer user={user} /> : <Login onLogin={handleLogin} />}
      </div>
      <div className="card">
        <Feed currentUser={user} />
      </div>
    </div>
  )
}
