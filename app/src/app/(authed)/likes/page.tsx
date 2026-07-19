"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, Zap, Sparkles, Heart, BadgeCheck, MapPin } from "lucide-react";

type Liker = {
  userId: string;
  displayName: string;
  age: number;
  avatarUrl: string;
  city: string;
  verified: boolean;
};

export default function LikesPage() {
  const [locked, setLocked] = useState(true);
  const [count, setCount] = useState(0);
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    fetch("/api/likers")
      .then((r) => {
        if (r.status === 401) {
          setGuest(true);
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setLocked(d.locked);
        setCount(d.count ?? 0);
        setLikers(d.likers ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  async function likeBack(userId: string) {
    await fetch("/api/swipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: userId, liked: true }),
    });
    setLikers((l) => l.filter((x) => x.userId !== userId));
    setCount((c) => Math.max(0, c - 1));
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display mb-6 text-2xl font-bold">
        Who likes you {count > 0 && <span className="text-gradient">({count})</span>}
      </h1>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : guest ? (
        <div className="glass flex flex-col items-center rounded-3xl p-10 text-center">
          <Heart className="h-10 w-10 text-[#ff5d52]" strokeWidth={1.5} />
          <p className="font-display mt-4 font-bold">Someone could be liking you right now</p>
          <p className="mt-2 max-w-xs text-sm text-muted">
            Create a free profile and start collecting likes tonight.
          </p>
          <Link href="/signup" className="btn-primary mt-6 text-sm">
            Join free
          </Link>
        </div>
      ) : locked ? (
        <div className="glass relative overflow-hidden rounded-3xl p-10 text-center">
          <div className="orb h-52 w-52 bg-[#ff2d78]/30 -top-10 -right-10" />
          <Eye className="mx-auto h-12 w-12 text-[#ff5d52]" strokeWidth={1.5} />
          <h2 className="font-display mt-4 text-xl font-bold">
            {count > 0 ? (
              <>
                <span className="text-gradient">{count}</span>{" "}
                {count === 1 ? "person likes" : "people like"} you right now
              </>
            ) : (
              "Someone's about to like you"
            )}
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
            Upgrade to Premium to see everyone who liked you and match
            instantly.
          </p>
          <Link href="/premium" className="btn-primary mt-6">
            <Zap className="h-4 w-4" /> Unlock with Premium
          </Link>

          {/* blurred teaser rows */}
          <div className="mt-8 space-y-2 blur-[6px] select-none" aria-hidden>
            {["Adaeze, 24", "Chidi, 27", "Bisi, 23"].map((n) => (
              <div key={n} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
                <div className="h-10 w-10 rounded-full bg-white/20" />
                <p className="text-sm font-medium">{n}</p>
              </div>
            ))}
          </div>
        </div>
      ) : likers.length === 0 ? (
        <div className="glass flex flex-col items-center rounded-3xl p-10 text-center">
          <Sparkles className="h-10 w-10 text-[#ff5d52]" strokeWidth={1.5} />
          <p className="font-display mt-4 font-bold">No pending likes</p>
          <p className="mt-2 text-sm text-muted">
            Post on the feed or boost your profile to get noticed.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {likers.map((l, i) => (
            <motion.div
              key={l.userId}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="glass rounded-3xl p-5 text-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={l.avatarUrl}
                alt=""
                className="mx-auto h-20 w-20 rounded-full bg-white/10 object-cover"
              />
              <p className="mt-3 flex items-center justify-center gap-1.5 font-semibold">
                {l.displayName}, {l.age}
                {l.verified && (
                  <BadgeCheck className="h-4 w-4 fill-sky-500 text-white" />
                )}
              </p>
              {l.city && (
                <p className="flex items-center justify-center gap-1 text-xs text-muted">
                  <MapPin className="h-3 w-3" /> {l.city}
                </p>
              )}
              <button
                onClick={() => likeBack(l.userId)}
                className="btn-primary mt-4 w-full !py-2.5 text-sm"
              >
                <Heart className="h-4 w-4 fill-white" /> Like back
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
