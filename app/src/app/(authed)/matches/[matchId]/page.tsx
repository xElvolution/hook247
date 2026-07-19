"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, SendHorizontal } from "lucide-react";

type Msg = { id: string; body: string; mine: boolean; at: string };
type Other = { userId: string; displayName: string; avatarUrl: string; verified: boolean };

export default function ChatPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = use(params);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [other, setOther] = useState<Other | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch(`/api/messages/${matchId}`);
    if (!res.ok) return;
    const data = await res.json();
    setOther(data.other);
    setMessages(data.messages);
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(load, 0);
    const poll = window.setInterval(load, 4000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft("");
    const res = await fetch(`/api/messages/${matchId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessages((m) => [...m, data.message]);
    }
    setSending(false);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-160px)] max-w-xl flex-col md:h-[calc(100vh-120px)]">
      {/* header */}
      <div className="glass flex items-center gap-3 rounded-2xl p-3">
        <Link href="/matches" className="px-2 text-muted hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {other && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={other.avatarUrl}
              alt=""
              className="h-10 w-10 rounded-full bg-white/10 object-cover"
            />
            <p className="flex items-center gap-1.5 font-semibold">
              {other.displayName}
              {other.verified && (
                <BadgeCheck className="h-4 w-4 fill-sky-500 text-white" />
              )}
            </p>
          </>
        )}
      </div>

      {/* messages */}
      <div className="scroll-thin my-4 flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted">
            You matched! Break the ice — ask about their vibe.
          </p>
        )}
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                m.mine
                  ? "bg-gradient-to-r from-[#ff2d78] to-[#ff6b2c] text-white rounded-br-md"
                  : "glass rounded-bl-md"
              }`}
            >
              {m.body}
            </div>
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* composer */}
      <form onSubmit={send} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Type a message…"
          value={draft}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="btn-primary !px-6"
          title="Send"
        >
          <SendHorizontal className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
