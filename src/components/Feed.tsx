import React, { useEffect, useState } from 'react'
import CommentInput from './CommentInput'

type User = { id: string; username: string }
type Comment = {
  id: string
  username: string
  text: string
  created_at: string
  replied_to: string | null
}
type Post = {
  id: string
  username: string
  text: string
  created_at: string
  comments: Comment[]
}

type ReplyTarget = { postId: string; commentId: string | null } | null

export function Feed({ currentUser }: { currentUser: User | null }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [replyTarget, setReplyTarget] = useState<ReplyTarget>(null)

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

  function openReply(postId: string, commentId: string | null) {
    if (!currentUser) return
    setReplyTarget((current) =>
      current && current.postId === postId && current.commentId === commentId ? null : { postId, commentId }
    )
  }

  function closeReply() {
    setReplyTarget(null)
  }

  async function handleSubmitted() {
    closeReply()
    await load()
  }

  function renderReplyInput(postId: string, replyTo: string | null) {
    if (!currentUser) return null
    if (!replyTarget || replyTarget.postId !== postId || replyTarget.commentId !== replyTo) return null

    return (
      <div className="reply-inline">
        <CommentInput
          postId={postId}
          userId={currentUser.id}
          replyTo={replyTo}
          onSubmitted={handleSubmitted}
        />
      </div>
    )
  }

  function renderComments(post: Post, parentId: string | null = null): React.ReactNode {
    const children = post.comments.filter((c) => (c.replied_to ?? null) === parentId)
    if (children.length === 0) return null

    return (
      <div className={parentId ? 'comment-thread nested' : 'comment-thread'}>
        {children.map((comment) => (
          <div key={comment.id} className="comment-block">
            <div className="comment-header">
              <div className="comment-author">@{comment.username}</div>
              <div className="comment-meta">
                <span className="meta">{new Date(comment.created_at).toLocaleString()}</span>
                <button
                  className="btn-link"
                  disabled={!currentUser}
                  onClick={() => openReply(post.id, comment.id)}
                >
                  Reply
                </button>
              </div>
            </div>
            <div className="comment-body">{comment.text}</div>
            {renderReplyInput(post.id, comment.id)}
            {renderComments(post, comment.id)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <h3>Home</h3>
      <hr className="sep" />
      <div className="timeline">
        {posts.map(p => (
          <article key={p.id} className="post">
            <div className="post-header">
              <div className="post-author">
                <strong>@{p.username}</strong>
              </div>
              <div className="post-meta">
                <span className="meta">{new Date(p.created_at).toLocaleString()}</span>
                <button
                  className="btn-link"
                  disabled={!currentUser}
                  onClick={() => openReply(p.id, null)}
                >
                  Reply
                </button>
              </div>
            </div>
            <div className="post-body">{p.text}</div>
            {renderReplyInput(p.id, null)}
            <div className="post-thread">
              {renderComments(p, null)}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
