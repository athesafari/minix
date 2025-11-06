import React, { useEffect, useState } from "react";
import Comment from "../components/Comment";
import CommentInput from "../components/CommentInput";

type CommentType = {
  id: string;
  text: string;
  username: string;
  replied_to: string | null;
};

export default function Thread() {
  const [comments, setComments] = useState<CommentType[]>([]);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null); // ✅ currently replying to
  const [refreshKey, setRefreshKey] = useState(0); // trigger reload

  const postId = "your-post-id-here"; // ⚙️ replace with dynamic later
  const userId = "your-user-id-here"; // ⚙️ from Supabase auth if available

  async function fetchComments() {
    const res = await fetch(`/api/comments?post_id=${postId}`);
    const data = await res.json();
    setComments(data);
  }

  useEffect(() => {
    fetchComments();
  }, [refreshKey]); // reload when new comment posted

  function renderThread(parentId: string | null = null) {
    const children = comments.filter((c) => c.replied_to === parentId);

    return (
      <div className="ml-3 border-l border-gray-200 pl-3">
        {children.map((comment) => (
          <div key={comment.id} className="mb-3">
            {/* Comment */}
            <Comment comment={comment} onReply={(id) => setActiveReplyId(id)} />

            {/* If this comment is currently being replied to, show input below it */}
            {activeReplyId === comment.id && (
              <CommentInput
                postId={postId}
                userId={userId}
                replyTo={comment.id}
                onSubmitted={() => {
                  setActiveReplyId(null);
                  setRefreshKey((k) => k + 1);
                }}
              />
            )}

            {/* Recursively render its replies */}
            {renderThread(comment.id)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-8">
      <h1 className="text-xl font-bold mb-4">Thread</h1>

      {/* Render entire threaded tree */}
      {renderThread(null)}

      {/* Default input (reply to post, not comment) */}
      {activeReplyId === null && (
        <CommentInput
          postId={postId}
          userId={userId}
          replyTo={null}
          onSubmitted={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
