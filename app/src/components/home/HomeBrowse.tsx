"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Flame,
  MapPin,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import LoadingScreen from "@/components/LoadingScreen";
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
  startingRate?: number | null;
  services?: Array<{ name: string }>;
};

type BrowseData = {
  featured: Card[];
  live: Card[];
  members: Card[];
  dbDown?: boolean;
};

const TABS = [
  { id: "all", label: "All" },
  { id: "redhot", label: "Red Hot" },
  { id: "available", label: "Available Today" },
  { id: "fresh", label: "Fresh" },
  { id: "new", label: "New" },
] as const;

function MemberCard({ member }: { member: Card }) {
  return (
    <Link
      href={`/profiles/${encodeURIComponent(member.userId)}`}
      className="profile-tile group relative block aspect-[3/4] overflow-hidden bg-[#211c22]"
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
      </div>

      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/90 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="flex items-center gap-1.5">
          <h3 className="font-display text-xl font-extrabold text-white">
            {member.displayName}, {member.age}
          </h3>
          {member.verified && (
            <BadgeCheck className="h-5 w-5 shrink-0 fill-[#df3a6a] text-white" />
          )}
        </div>
        {member.city && (
          <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-white/85">
            <MapPin className="h-3.5 w-3.5" /> {member.city}
          </p>
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
        {dbDown ? "Profiles are being prepared" : "No profiles in that area"}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted">
        {dbDown
          ? "The community database is not connected yet. Try again shortly."
          : "Try another city, service, or availability option."}
      </p>
      <Link href="/" className="btn-primary mt-5 text-sm">
        Browse profiles
      </Link>
    </div>
  );
}

export default function HomeBrowse({ authed }: { authed: boolean }) {
  const featuredRail = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const [data, setData] = useState<BrowseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [filters, setFilters] = useState<BrowseFilters>(EMPTY_BROWSE_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      country: searchParams.get("country") ?? "",
      state: searchParams.get("state") ?? "",
      city: searchParams.get("city") ?? "",
    }));
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ tab });
    const q = searchParams.get("q");
    if (q) params.set("q", q);
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
  }, [filters, tab, searchParams]);

  const advancedFilterCount = Object.values(filters).filter(Boolean).length;
  const activeFilters = Boolean(advancedFilterCount || tab !== "all");

  function resetFilters() {
    setTab("all");
    setFilters(EMPTY_BROWSE_FILTERS);
  }

  function scrollFeatured(direction: number) {
    featuredRail.current?.scrollBy({ left: direction * 260, behavior: "smooth" });
  }

  useEffect(() => {
    const el = featuredRail.current;
    if (!el || !data?.featured.length) return;
    let paused = false;
    const pause = () => {
      paused = true;
    };
    const resume = () => {
      paused = false;
    };
    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", resume);
    el.addEventListener("touchstart", pause, { passive: true });
    const timer = window.setInterval(() => {
      if (paused) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 8) return;
      if (el.scrollLeft >= max - 12) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: 270, behavior: "smooth" });
      }
    }, 2600);
    return () => {
      window.clearInterval(timer);
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", resume);
      el.removeEventListener("touchstart", pause);
    };
  }, [data?.featured.length]);

  return (
    <div className="home-discovery">
      <div className="listing-toolbar">
        <div className="tabs-row" role="tablist" aria-label="Profile filters">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="filter-chip"
              data-active={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => setFiltersOpen(true)}
          aria-label="Filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {advancedFilterCount > 0 && <span className="filter-count">{advancedFilterCount}</span>}
        </button>
      </div>

      {data && data.featured.length > 0 && (
        <section className="mt-9">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">
                <Flame className="h-3.5 w-3.5 fill-current" /> Hooks247 picks
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

      {data && data.live.length > 0 && (
        <section className="mt-10">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Live now
              </p>
              <h2 className="font-display mt-1.5 text-xl font-bold">Live rooms</h2>
            </div>
            <Link href="/live" className="section-link">
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

      <section className="mt-6">
        {activeFilters && (
          <button type="button" onClick={resetFilters} className="section-link mb-3">
            Reset filters <X className="h-3.5 w-3.5" />
          </button>
        )}
        {loading && !data ? (
          <LoadingScreen fill={false} label="Loading profiles" />
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
            Feature your profile.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/[0.65]">
            Add photos, rates and WhatsApp. Clients in your area can find you and
            message you directly.
          </p>
        </div>
        <Link href="/signup" className="btn-light shrink-0 text-sm">
          Sign up to get hooked
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
