import React, { useState } from 'react'
type User = { id:string; username:string }

export function Composer({ user }: { user: User }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  async function post() {
    if (!text.trim()) return
    setLoading(true)
    await fetch('/api/posts', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username: user.username, text })
    })
    setText(''); setLoading(false)
    window.dispatchEvent(new CustomEvent('feed:refresh'))
  }

  return (
    <div>
      <textarea rows={3} placeholder="What's happening?" value={text} onChange={e=>setText(e.target.value)} />
      <div className="row" style={{justifyContent:'space-between', marginTop:8}}>
        <div />
        <button className="btn" disabled={loading} onClick={post}>Tweet</button>
      </div>
    </div>
  )
}
