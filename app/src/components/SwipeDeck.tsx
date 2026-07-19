"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Flame,
  Heart,
  MapPin,
  Radio,
  SlidersHorizontal,
  Users,
} from "lucide-react";

type Candidate = {
  userId: string;
  displayName: string;
  age: number;
  bio: string;
  city: string;
  state: string;
  interests: string[];
  avatarUrl: string;
  photos: string[];
  verified: boolean;
  boosted: boolean;
  live: boolean;
  services: string[];
};

const FILTERS = [
  { id: "all", label: "For you" },
  { id: "live", label: "Live now" },
  { id: "verified", label: "Verified" },
  { id: "new", label: "New faces" },
] as const;

function ProfileCard({
  guest,
  liked,
  profile,
  onLike,
}: {
  guest: boolean;
  liked: boolean;
  profile: Candidate;
  onLike: (profile: Candidate) => void;
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="discover-profile-card"
    >
      <Link
        href={`/profiles/${encodeURIComponent(profile.userId)}`}
        className="discover-profile-media"
        aria-label={`View ${profile.displayName}'s profile`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={profile.avatarUrl} alt={profile.displayName} loading="lazy" />
        <div className="discover-profile-badges">
          {profile.live && (
            <span className="availability-badge"><Radio className="h-3 w-3" /> Live</span>
          )}
          {profile.boosted && (
            <span className="boost-badge"><Flame className="h-3 w-3 fill-current" /> Featured</span>
          )}
        </div>
      </Link>

      <div className="discover-profile-content">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            href={`/profiles/${encodeURIComponent(profile.userId)}`}
            className="truncate font-display text-lg font-extrabold hover:text-[#ef789a]"
          >
            {profile.displayName}, {profile.age}
          </Link>
          {profile.verified && <BadgeCheck className="h-4 w-4 shrink-0 fill-[#df3a6a] text-white" />}
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          <MapPin className="h-3.5 w-3.5" /> {[profile.city, profile.state].filter(Boolean).join(", ")}
        </p>
        <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-white/70">{profile.bio}</p>

        <div className="mt-3 flex min-h-7 gap-1.5 overflow-hidden">
          {(profile.services.length ? profile.services : profile.interests).slice(0, 2).map((item) => (
            <span key={item} className="filter-chip !max-w-[48%] truncate">{item}</span>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3">
          {profile.live ? (
            <Link href={`/live/${encodeURIComponent(profile.userId)}`} className="btn-primary !px-3 !py-2 text-xs">
              <Radio className="h-3.5 w-3.5" /> Watch live
            </Link>
          ) : (
            <Link href={`/profiles/${encodeURIComponent(profile.userId)}`} className="btn-ghost !px-3 !py-2 text-xs">
              View profile
            </Link>
          )}
          <button
            type="button"
            className="btn-ghost !px-3 !py-2 text-xs"
            data-liked={liked}
            onClick={() => onLike(profile)}
            aria-label={`${liked ? "Unlike" : "Like"} ${profile.displayName}`}
          >
            <Heart className={`h-3.5 w-3.5 ${liked ? "fill-[#df3a6a] text-[#df3a6a]" : ""}`} />
            {liked ? "Liked" : guest ? "Like" : "Connect"}
          </button>
        </div>
      </div>
    </motion.article>
  );
}

export default function SwipeDeck() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [liked, setLiked] = useState<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/discover", { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        setProfiles(data.profiles ?? []);
        setGuest(!!data.guest);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const visible = useMemo(() => {
    if (filter === "live") return profiles.filter((profile) => profile.live);
    if (filter === "verified") return profiles.filter((profile) => profile.verified);
    if (filter === "new") return [...profiles].reverse();
    return profiles;
  }, [filter, profiles]);

  async function like(profile: Candidate) {
    if (guest) {
      router.push(`/signup?next=${encodeURIComponent(`/profiles/${profile.userId}`)}`);
      return;
    }
    const wasLiked = liked.has(profile.userId);
    setLiked((current) => {
      const next = new Set(current);
      if (wasLiked) next.delete(profile.userId);
      else next.add(profile.userId);
      return next;
    });
    await fetch("/api/swipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: profile.userId, liked: !wasLiked }),
    });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="section-heading-row items-end">
        <div>
          <p className="section-kicker"><Users className="h-3.5 w-3.5" /> Discover</p>
          <h1 className="font-display mt-2 text-3xl font-extrabold">Find your kind of connection</h1>
          <p className="mt-2 text-sm text-muted">Browse every profile, open live rooms, and compare services before connecting.</p>
        </div>
        {!loading && <span className="text-xs text-muted">{visible.length} profiles</span>}
      </div>

      <div className="tabs-row mt-6" role="tablist" aria-label="Discover filters">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            className="browse-tab"
            data-active={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.id === "live" && <Radio className="mr-1 inline h-3.5 w-3.5" />}
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="discover-grid mt-5" aria-label="Loading profiles">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="aspect-[4/5] animate-pulse rounded-lg bg-white/[0.055]" />
          ))}
        </div>
      ) : visible.length ? (
        <motion.div layout className="discover-grid mt-5">
          {visible.map((profile) => (
            <ProfileCard
              key={profile.userId}
              guest={guest}
              liked={liked.has(profile.userId)}
              profile={profile}
              onLike={like}
            />
          ))}
        </motion.div>
      ) : (
        <div className="empty-panel mt-5 flex min-h-64 flex-col items-center justify-center px-6 text-center">
          <SlidersHorizontal className="h-8 w-8 text-[#df3a6a]" />
          <h2 className="font-display mt-3 text-lg font-bold">No profiles in this view</h2>
          <button type="button" className="btn-ghost mt-4 text-sm" onClick={() => setFilter("all")}>Show everyone</button>
        </div>
      )}
    </div>
  );
}
