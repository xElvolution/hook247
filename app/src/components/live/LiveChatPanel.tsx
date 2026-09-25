"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageCircle, Send } from "lucide-react";
import type { LiveComment } from "./types";

export default function LiveChatPanel({
  comments,
  hostId,
  status,
  disabled,
  onSend,
}: {
  comments: LiveComment[];
  hostId: string;
  status: string;
  disabled?: boolean;
  onSend: (body: string) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending || disabled) return;
    setSending(true);
    setError("");
    const failure = await onSend(body);
    setSending(false);
    if (failure) setError(failure);
    else setDraft("");
  }

  return (
    <aside className="stream-chat-panel">
      <div className="stream-chat-header">
        <span><MessageCircle className="h-4 w-4" /> Live chat</span>
        <small>{status}</small>
      </div>
      <div ref={listRef} className="stream-chat-messages live-chat-scroll" aria-live="polite">
        {comments.length === 0 ? (
          <p className="live-chat-empty"><span>No comments yet. Say hi.</span></p>
        ) : (
          comments.map((c) => (
            <p key={c.id}>
              <strong>
                {c.name}
                {c.userId === hostId ? <em className="live-host-tag">Host</em> : null}
              </strong>
              <span>{c.body}</span>
            </p>
          ))
        )}
      </div>
      {error ? <p className="live-chat-error" role="alert">{error}</p> : null}
      <form className="stream-chat-form" onSubmit={submit}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={200}
          disabled={disabled}
          placeholder={disabled ? "Chat is closed" : "Add a comment"}
          aria-label="Live comment"
        />
        <button type="submit" aria-label="Send comment" disabled={disabled || sending || !draft.trim()}>
          <Send className="h-4 w-4" />
        </button>
      </form>
    </aside>
  );
}
