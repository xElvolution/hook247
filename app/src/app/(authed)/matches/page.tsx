"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { HeartHandshake, BadgeCheck } from "lucide-react";

type MatchItem = {
  matchId: string;
  displayName: string;
  age: number | null;
  avatarUrl: string;
  verified: boolean;
  city: string;
  lastMessage: { body: string; mine: boolean; at: string } | null;
  matchedAt: string;
};

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    fetch("/api/matches")
      .then((r) => {
        if (r.status === 401) {
          setGuest(true);
          return null;
        }
        return r.json();
      })
      .then((d) => d && setMatches(d.matches ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display mb-6 text-2xl font-bold">Matches</h1>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : guest ? (
        <div className="glass flex flex-col items-center rounded-3xl p-10 text-center">
          <HeartHandshake className="h-10 w-10 text-[#ff5d52]" strokeWidth={1.5} />
          <p className="font-display mt-4 font-bold">Your matches will live here</p>
          <p className="mt-2 text-sm text-muted">
            Profiles are public. WhatsApp a profile, or create your own.
          </p>
          <Link href="/signup" className="btn-primary mt-6 text-sm">
            Browse profiles
          </Link>
        </div>
      ) : matches.length === 0 ? (
        <div className="glass flex flex-col items-center rounded-3xl p-10 text-center">
          <HeartHandshake className="h-10 w-10 text-[#ff5d52]" strokeWidth={1.5} />
          <p className="font-display mt-4 font-bold">No matches yet</p>
          <p className="mt-2 text-sm text-muted">
            Keep swiping. When you both like each other, they show up here.
          </p>
          <Link href="/discover" className="btn-primary mt-6 text-sm">
            Go discover
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((m, i) => (
            <motion.div
              key={m.matchId}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.35 }}
            >
              <Link
                href={`/matches/${m.matchId}`}
                className="glass flex items-center gap-4 rounded-2xl p-4 transition hover:border-white/25"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.avatarUrl}
                  alt=""
                  className="h-14 w-14 rounded-full bg-white/10 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-semibold">
                    {m.displayName}
                    {m.age ? `, ${m.age}` : ""}
                    {m.verified && (
                      <BadgeCheck className="h-4 w-4 fill-sky-500 text-white" />
                    )}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {m.lastMessage
                      ? `${m.lastMessage.mine ? "You: " : ""}${m.lastMessage.body}`
                      : "New match. Say hi!"}
                  </p>
                </div>
                {!m.lastMessage && (
                  <span className="rounded-full bg-gradient-to-r from-[#ff2d78] to-[#ff6b2c] px-2.5 py-1 text-[10px] font-bold">
                    NEW
                  </span>
                )}
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
