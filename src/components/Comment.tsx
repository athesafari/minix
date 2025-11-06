import React from "react";

type CommentProps = {
  comment: any;
  onReply: (id: string) => void;
};

export default function Comment({ comment, onReply }: CommentProps) {
  return (
    <div className="border-b border-gray-200 py-2 pl-4">
      <p className="text-sm text-gray-700">
        <strong>{comment.username}</strong> {comment.text}
      </p>
      <button
        onClick={() => onReply(comment.id)}
        className="text-blue-500 text-xs mt-1 hover:underline"
      >
        Reply
      </button>
    </div>
  );
}
