import React, { useState } from 'react'

export function Login({ onLogin }: { onLogin: (u:string)=>void }) {
  const [username, setUsername] = useState('')
  return (
    <div className="row">
      <input className="input" placeholder="Enter a username" value={username} onChange={e=>setUsername(e.target.value)} />
      <button className="btn" onClick={()=>username.trim() && onLogin(username.trim())}>Login</button>
    </div>
  )
}
