import React, { useState } from "react";

type CommentInputProps = {
  postId: string;
  userId: string;
  replyTo?: string | null;
  onSubmitted: () => void;
};

export default function CommentInput({
  postId,
  userId,
  replyTo,
  onSubmitted,
}: CommentInputProps) {
  const [text, setText] = useState("");

  async function handleSubmit() {
    if (!text.trim()) return;

    await fetch("/api/comments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        post_id: postId,
        user_id: userId,
        text,
        replied_to: replyTo, // ✅ important: pass parent comment id if replying
      }),
    });

    setText("");
    onSubmitted();
  }

  return (
    <div className="mt-2 ml-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          replyTo
            ? "Replying to a comment..."
            : "Write your comment here..."
        }
        className="border border-gray-300 rounded w-full p-2 text-sm"
      />
      <button
        onClick={handleSubmit}
        className="bg-blue-500 text-white text-sm px-3 py-1 rounded mt-1"
      >
        Post
      </button>
    </div>
  );
}
