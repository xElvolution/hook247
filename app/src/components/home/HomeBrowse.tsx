"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Flame,
  Heart,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import SearchFiltersModal, {
  EMPTY_BROWSE_FILTERS,
  type BrowseFilters,
} from "@/components/SearchFiltersModal";

type Card = {
  userId: string;
  displayName: string;
  age: number;
  city: string;
  bio: string;
  avatarUrl: string;
  interests: string[];
  verified: boolean;
  boosted: boolean;
  online: boolean;
  joinedAt: string;
};

type BrowseData = {
  featured: Card[];
  live: Card[];
  members: Card[];
  dbDown?: boolean;
};

const TABS = [
  { id: "all", label: "Recommended" },
  { id: "online", label: "Available now" },
  { id: "new", label: "New faces" },
  { id: "verified", label: "Verified" },
] as const;

const INTERESTS = ["", "Nightlife", "Music", "Travel", "Foodie", "Art", "Tech"];

function MemberCard({ member }: { member: Card }) {
  return (
    <Link
      href={`/profiles/${encodeURIComponent(member.userId)}`}
      className="profile-tile group relative block aspect-[4/5] overflow-hidden bg-[#211c22]"
      aria-label={`View ${member.displayName}'s profile`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={member.avatarUrl}
        alt={member.displayName}
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        loading="lazy"
      />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="flex flex-wrap gap-1.5">
          {member.online && (
            <span className="availability-badge">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Available
            </span>
          )}
          {member.boosted && (
            <span className="boost-badge">
              <Flame className="h-3 w-3 fill-current" /> Featured
            </span>
          )}
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-md transition group-hover:bg-[#df3a6a]">
          <Heart className="h-4 w-4" />
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="flex items-center gap-1.5">
          <h3 className="font-display text-lg font-bold text-white">
            {member.displayName}, {member.age}
          </h3>
          {member.verified && (
            <BadgeCheck className="h-4 w-4 shrink-0 fill-[#df3a6a] text-white" />
          )}
        </div>
        {member.city && (
          <p className="mt-1 flex items-center gap-1 text-xs text-white/[0.72]">
            <MapPin className="h-3 w-3" /> {member.city}
          </p>
        )}
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/[0.68]">
          {member.bio || "Here for a real connection and a good conversation."}
        </p>
        {member.interests.length > 0 && (
          <div className="mt-3 flex gap-1.5 overflow-hidden">
            {member.interests.slice(0, 2).map((interest) => (
              <span key={interest} className="profile-interest">
                {interest}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function EmptyState({ dbDown }: { dbDown?: boolean }) {
  return (
    <div className="empty-panel col-span-full flex min-h-64 flex-col items-center justify-center px-6 text-center">
      <Users className="h-9 w-9 text-[#df3a6a]" strokeWidth={1.6} />
      <h3 className="font-display mt-4 text-lg font-bold">
        {dbDown ? "Profiles are being prepared" : "No profiles match those filters"}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted">
        {dbDown
          ? "The community database is not connected yet. Try again shortly."
          : "Try another city, interest, or availability option."}
      </p>
      <Link href="/discover" className="btn-primary mt-5 text-sm">
        Browse Discover
      </Link>
    </div>
  );
}

export default function HomeBrowse({ authed }: { authed: boolean }) {
  const featuredRail = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<BrowseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [interest, setInterest] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<BrowseFilters>(EMPTY_BROWSE_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ tab });
    if (interest) params.set("interest", interest);
    if (query) params.set("q", query);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    fetch(`/api/browse?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((nextData: BrowseData) => setData(nextData))
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setData({ featured: [], live: [], members: [], dbDown: true });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [filters, interest, query, tab]);

  const connectionHref = authed ? "/discover" : "/signup";
  const advancedFilterCount = Object.values(filters).filter(Boolean).length;
  const activeFilters = Boolean(advancedFilterCount || interest || query || tab !== "all");
  const locationLabel = filters.city || filters.state || filters.country || "Location & profile filters";

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(searchDraft.trim());
  }

  function resetFilters() {
    setTab("all");
    setInterest("");
    setSearchDraft("");
    setQuery("");
    setFilters(EMPTY_BROWSE_FILTERS);
  }

  function scrollFeatured(direction: number) {
    featuredRail.current?.scrollBy({ left: direction * 520, behavior: "smooth" });
  }

  return (
    <div className="home-discovery">
      <section className="home-intro">
        <div>
          <p className="section-kicker">
            <Sparkles className="h-3.5 w-3.5" /> Curated for your city
          </p>
          <h1 className="font-display mt-3 max-w-2xl text-3xl font-extrabold md:text-[2.65rem] md:leading-[1.08]">
            Meet someone worth staying up for.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted md:text-base">
            Browse verified people, see who is active, and move from first look to
            first message without the endless guessing.
          </p>
        </div>
        <div className="hidden items-center gap-3 lg:flex">
          <div className="trust-note">
            <ShieldCheck className="h-5 w-5 text-[#df3a6a]" />
            <span>
              <strong>Safer profiles</strong>
              <small>Verification at a glance</small>
            </span>
          </div>
          <Link href={connectionHref} className="btn-primary text-sm">
            {authed ? "Start matching" : "Join Hook247"}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="search-panel" aria-label="Find profiles">
        <form onSubmit={submitSearch} className="grid gap-3 lg:grid-cols-[1fr_250px_auto]">
          <label className="search-field">
            <Search className="h-[18px] w-[18px] text-muted" />
            <span className="sr-only">Search profiles</span>
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search a name, city, or vibe"
            />
            {searchDraft && (
              <button
                type="button"
                onClick={() => {
                  setSearchDraft("");
                  setQuery("");
                }}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>

          <button
            type="button"
            className="select-field justify-between text-left"
            onClick={() => setFiltersOpen(true)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <SlidersHorizontal className="h-[18px] w-[18px] shrink-0 text-[#df3a6a]" />
              <span className="truncate text-sm">{locationLabel}</span>
            </span>
            {advancedFilterCount > 0 && (
              <span className="filter-count">{advancedFilterCount}</span>
            )}
          </button>

          <button type="submit" className="btn-primary min-h-12 px-7 text-sm">
            Find people
          </button>
        </form>

        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
          {INTERESTS.map((item) => (
            <button
              key={item || "all"}
              type="button"
              className="filter-chip"
              data-active={interest === item}
              aria-pressed={interest === item}
              onClick={() => setInterest(item)}
            >
              {item || "All interests"}
            </button>
          ))}
        </div>
      </section>

      {data && data.live.length > 0 && (
        <section className="mt-9">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Live now
              </p>
              <h2 className="font-display mt-1.5 text-xl font-bold">Live rooms</h2>
            </div>
            <Link href="/discover" className="section-link">
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="story-rail mt-4">
            {data.live.map((member) => (
              <Link
                key={member.userId}
                href={`/live/${encodeURIComponent(member.userId)}`}
                className="story-profile"
                aria-label={`Watch ${member.displayName} live`}
              >
                <span className="story-ring">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={member.avatarUrl} alt={member.displayName} />
                  <span className="story-online" />
                </span>
                <span>{member.displayName}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data && data.featured.length > 0 && (
        <section className="mt-10">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">
                <Flame className="h-3.5 w-3.5 fill-current" /> Hook247 picks
              </p>
              <h2 className="font-display mt-1.5 text-xl font-bold">Featured profiles</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollFeatured(-1)}
                className="icon-button"
                aria-label="Previous featured profiles"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollFeatured(1)}
                className="icon-button"
                aria-label="Next featured profiles"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={featuredRail} className="featured-rail mt-4">
            {data.featured.map((member) => (
              <div key={member.userId} className="w-[238px] shrink-0 sm:w-[258px]">
                <MemberCard member={member} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-11">
        <div className="section-heading-row items-end">
          <div>
            <p className="section-kicker">Explore the community</p>
            <h2 className="font-display mt-1.5 text-2xl font-bold">Profiles for you</h2>
            {data && !loading && (
              <p className="mt-1 text-sm text-muted">
                {data.members.length} {data.members.length === 1 ? "person" : "people"} found
              </p>
            )}
          </div>
          {activeFilters && (
            <button type="button" onClick={resetFilters} className="section-link">
              Reset filters <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="tabs-row mt-5" role="tablist" aria-label="Profile filters">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className="browse-tab"
              data-active={tab === item.id}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading && !data ? (
          <div className="profile-grid mt-5" aria-label="Loading profiles">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="aspect-[4/5] animate-pulse bg-white/[0.055]" />
            ))}
          </div>
        ) : !data || data.members.length === 0 ? (
          <div className="profile-grid mt-5">
            <EmptyState dbDown={data?.dbDown} />
          </div>
        ) : (
          <motion.div layout className="profile-grid mt-5">
            {data.members.map((member, index) => (
              <motion.div
                layout
                key={member.userId}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(index * 0.025, 0.2) }}
              >
                <MemberCard member={member} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      <section className="community-cta mt-12">
        <div>
          <p className="section-kicker text-white/[0.65]">Your next move</p>
          <h2 className="font-display mt-2 text-2xl font-extrabold md:text-3xl">
            A profile is only the beginning.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/[0.65]">
            Match privately, post to the community feed, and start a conversation
            when the interest is mutual.
          </p>
        </div>
        <Link href="/discover" className="btn-light shrink-0 text-sm">
          Open Discover
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <footer className="mt-10 border-t border-line py-7 text-center text-xs text-muted">
        Strictly 18+ · Meet in public first · Never send money to someone you have not met
      </footer>

      {filtersOpen && (
        <SearchFiltersModal
          key={JSON.stringify(filters)}
          initialFilters={filters}
          onApply={setFilters}
          onClose={() => setFiltersOpen(false)}
        />
      )}
    </div>
  );
}
