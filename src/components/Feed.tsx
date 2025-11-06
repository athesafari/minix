import React, { useEffect, useState } from 'react'

type User = { id:string; username:string }
type Comment = { id:string; username:string; text:string; created_at:string }
type Post = { id:string; username:string; text:string; created_at:string; comments: Comment[] }

export function Feed({ currentUser }: { currentUser: User | null }) {
  const [posts, setPosts] = useState<Post[]>([])

  async function load() {
    const r = await fetch('/api/posts')
    const data = await r.json()
    setPosts(data.posts || [])
  }

  useEffect(() => {
    load()
    const h = () => load()
    window.addEventListener('feed:refresh', h)
    return () => window.removeEventListener('feed:refresh', h)
  }, [])

  async function reply(postId: string, inputId: string) {
    const input = (document.getElementById(inputId) as HTMLInputElement)
    const text = input.value.trim()
    if (!text || !currentUser) return
    await fetch('/api/comments', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ postId, username: currentUser.username, text })
    })
    input.value=''
    load()
  }

  return (
    <div>
      <h3>Home</h3>
      <hr className="sep" />
      {posts.map(p => (
        <div key={p.id} className="post">
          <div style={{display:'flex', justifyContent:'space-between'}}>
            <strong>@{p.username}</strong>
            <span className="meta">{new Date(p.created_at).toLocaleString()}</span>
          </div>
          <div style={{marginTop:6}}>{p.text}</div>
          <div className="row" style={{marginTop:8}}>
            <input id={'reply-'+p.id} className="input" placeholder="Reply…" />
            <button className="btn" onClick={()=>reply(p.id, 'reply-'+p.id)} disabled={!currentUser}>Comment</button>
          </div>
          <div style={{marginTop:8}}>
            {p.comments?.map(c => (
              <div key={c.id} className="comment">
                <strong>@{c.username}</strong> {c.text} <span className="meta">· {new Date(c.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
