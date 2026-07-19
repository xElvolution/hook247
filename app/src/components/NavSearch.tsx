"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, LoaderCircle, MapPin, Search, X } from "lucide-react";

type SearchResult = {
  userId: string;
  displayName: string;
  age: number;
  city: string;
  avatarUrl: string;
  verified: boolean;
};

export default function NavSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/browse?q=${encodeURIComponent(normalized)}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((data) => setResults((data.members ?? []).slice(0, 6)))
        .catch((error: Error) => {
          if (error.name !== "AbortError") setResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!results[0]) return;
    router.push(`/profiles/${encodeURIComponent(results[0].userId)}`);
    close();
  }

  const showResults = query.trim().length >= 2;

  return (
    <div className="nav-search" data-open={open}>
      {open && <button type="button" className="nav-search-backdrop" onClick={close} aria-label="Close search" />}
      <button type="button" className="nav-search-trigger" onClick={() => setOpen(true)} aria-label="Search profiles">
        <Search className="h-[18px] w-[18px]" />
      </button>
      <form className="nav-search-form" onSubmit={submit}>
        <Search className="h-[17px] w-[17px] text-muted" />
        <input value={query} onFocus={() => setOpen(true)} onChange={(event) => setQuery(event.target.value)} placeholder="Search profiles, city, or service" aria-label="Search Hook247" />
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin text-muted" /> : query && (
          <button type="button" onClick={close} aria-label="Clear search"><X className="h-4 w-4" /></button>
        )}
      </form>

      {showResults && (
        <div className="nav-search-results">
          {results.length > 0 ? results.map((profile) => (
            <Link key={profile.userId} href={`/profiles/${encodeURIComponent(profile.userId)}`} onClick={close}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={profile.avatarUrl} alt={profile.displayName} />
              <span>
                <strong>{profile.displayName}, {profile.age} {profile.verified && <BadgeCheck className="h-3.5 w-3.5 fill-[#df3a6a] text-white" />}</strong>
                <small><MapPin className="h-3 w-3" /> {profile.city}</small>
              </span>
            </Link>
          )) : !loading && <p>No profiles found</p>}
        </div>
      )}
    </div>
  );
}
