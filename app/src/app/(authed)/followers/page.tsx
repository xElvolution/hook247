"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, MapPin, MessageSquareText, UserCheck, UserPlus, Users } from "lucide-react";
import { useRealtimeEvent } from "@/lib/realtimeClient";

type Person = {
  userId: string;
  displayName: string;
  age: number;
  avatarUrl: string;
  city: string;
  verified: boolean;
  escort: boolean;
  since: string;
  isNew: boolean;
  youFollow: boolean;
  followsYou: boolean;
};
type Tab = "followers" | "following";

function since(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return "Today";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export default function FollowersPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("followers");
  const [people, setPeople] = useState<Person[]>([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState("");

  const load = useCallback(async (which: Tab) => {
    try {
      const r = await fetch(`/api/followers?tab=${which}`, { cache: "no-store" });
      if (r.status === 401) return setGuest(true);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setPeople(d.people ?? []);
      setCounts(d.counts ?? { followers: 0, following: 0 });
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  useRealtimeEvent("follow:new", () => {
    if (tab === "followers") void load("followers");
    else setCounts((c) => ({ ...c, followers: c.followers + 1 }));
  });

  async function toggle(person: Person) {
    setBusy(person.userId);
    const next = !person.youFollow;
    const res = await fetch("/api/follow", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: person.userId }),
    }).catch(() => null);
    setBusy("");
    if (!res?.ok) return;
    if (tab === "following" && !next) {
      setPeople((list) => list.filter((p) => p.userId !== person.userId));
    } else {
      setPeople((list) => list.map((p) => (p.userId === person.userId ? { ...p, youFollow: next } : p)));
    }
    setCounts((c) => ({ ...c, following: Math.max(0, c.following + (next ? 1 : -1)) }));
  }

  async function message(person: Person) {
    setBusy(`m:${person.userId}`);
    const res = await fetch("/api/messages/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: person.userId }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setBusy("");
    if (res?.ok && body.matchId) router.push(`/matches/${body.matchId}`);
  }

  if (guest) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="glass flex flex-col items-center rounded-3xl p-10 text-center">
          <Users className="h-10 w-10 text-[#ff5d52]" strokeWidth={1.5} />
          <p className="font-display mt-4 font-bold">See who follows you</p>
          <p className="mt-2 text-sm text-muted">Sign in to see your followers and the people you follow.</p>
          <Link href="/login?next=/followers" className="btn-primary mt-6 text-sm">Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-2xl font-bold">Followers</h1>
      <div className="pulse-tabs mt-4" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "followers"} data-active={tab === "followers"} onClick={() => { if (tab !== "followers") { setLoading(true); setTab("followers"); } }}>
          Followers ({counts.followers.toLocaleString("en-NG")})
        </button>
        <button type="button" role="tab" aria-selected={tab === "following"} data-active={tab === "following"} onClick={() => { if (tab !== "following") { setLoading(true); setTab("following"); } }}>
          Following ({counts.following.toLocaleString("en-NG")})
        </button>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2" aria-label="Loading">
          {[0, 1, 2].map((i) => <div key={i} className="dm-skeleton" />)}
        </div>
      ) : failed ? (
        <div className="glass mt-4 flex flex-col items-center rounded-3xl p-8 text-center">
          <p className="font-display font-bold">Could not load this list</p>
          <button type="button" onClick={() => { setLoading(true); void load(tab); }} className="btn-primary mt-4 text-sm">Try again</button>
        </div>
      ) : people.length === 0 ? (
        <div className="glass mt-4 flex flex-col items-center rounded-3xl p-10 text-center">
          <Users className="h-10 w-10 text-[#ff5d52]" strokeWidth={1.5} />
          <p className="font-display mt-4 font-bold">{tab === "followers" ? "No followers yet" : "You are not following anyone yet"}</p>
          <p className="mt-2 text-sm text-muted">
            {tab === "followers" ? "Post on the feed, go live or boost your profile to get noticed." : "Follow profiles you like to keep up with them."}
          </p>
          <Link href="/" className="btn-primary mt-6 text-sm">Discover Profiles</Link>
        </div>
      ) : (
        <ul className="follow-list mt-4">
          {people.map((p) => (
            <li key={p.userId} data-new={p.isNew}>
              <Link href={`/profiles/${encodeURIComponent(p.userId)}`} className="follow-person">
                {p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatarUrl} alt="" />
                ) : (
                  <span className="follow-avatar-fallback">{p.displayName.slice(0, 1).toUpperCase()}</span>
                )}
                <span className="min-w-0">
                  <strong>
                    <span className="truncate">{p.displayName}{p.age ? `, ${p.age}` : ""}</span>
                    {p.verified ? <BadgeCheck className="h-4 w-4 shrink-0 fill-sky-500 text-white" /> : null}
                    {p.isNew ? <b className="follow-new">New</b> : null}
                  </strong>
                  <small>
                    {p.city ? <><MapPin className="h-3 w-3" /> {p.city} · </> : null}
                    {tab === "followers" ? `Followed you ${since(p.since).toLowerCase()}` : p.followsYou ? "Follows you" : `Since ${since(p.since).toLowerCase()}`}
                  </small>
                </span>
              </Link>
              <div className="follow-actions">
                <button type="button" className="coin-icon-button" aria-label={`Message ${p.displayName}`} onClick={() => void message(p)} disabled={busy === `m:${p.userId}`}>
                  {busy === `m:${p.userId}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  className={p.youFollow ? "btn-ghost !px-3 !py-1.5 text-xs" : "btn-primary !px-3 !py-1.5 text-xs"}
                  onClick={() => void toggle(p)}
                  disabled={busy === p.userId}
                >
                  {busy === p.userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : p.youFollow ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                  {p.youFollow ? "Following" : tab === "followers" ? "Follow back" : "Follow"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
