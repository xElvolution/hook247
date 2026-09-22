"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { COUNTRIES, citiesFor, statesFor } from "@/lib/profileOptions";

const QUICK_CITIES = [
  { label: "Lekki", country: "Nigeria", state: "Lagos", city: "Lekki" },
  { label: "Ikeja", country: "Nigeria", state: "Lagos", city: "Ikeja" },
  { label: "Port Harcourt", country: "Nigeria", state: "Rivers", city: "Port Harcourt" },
  { label: "Abuja", country: "Nigeria", state: "Federal Capital Territory", city: "Wuse" },
];

export default function NavSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  const states = statesFor(country);
  const cities = citiesFor(country, state);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  function apply(next?: { country?: string; state?: string; city?: string; query?: string }) {
    const nextCountry = next?.country ?? country;
    const nextState = next?.state ?? state;
    const nextCity = next?.city ?? city;
    const nextQuery = (next?.query ?? query).trim();

    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    if (nextCountry) params.set("country", nextCountry);
    if (nextState) params.set("state", nextState);
    if (nextCity) params.set("city", nextCity);
    router.push(`/?${params.toString()}`);
    close();
  }

  const modal = open ? (
    <div className="city-search-backdrop" onClick={close}>
      <section
        className="city-search-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="city-search-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="section-kicker">Search</p>
            <h2 id="city-search-title" className="font-display mt-1 text-2xl font-extrabold">
              Curated for your city
            </h2>
            <p className="mt-1 text-sm text-muted">Search Lekki, Ikeja, Port Harcourt, Abuja and more.</p>
          </div>
          <button type="button" className="icon-button" onClick={close} aria-label="Close search">
            <X className="h-5 w-5" />
          </button>
        </header>

        <label className="search-field mt-5">
          <Search className="h-[18px] w-[18px] text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Lekki, Ikeja, Port Harcourt..."
            onKeyDown={(event) => {
              if (event.key === "Enter") apply();
            }}
          />
        </label>

        <div className="city-search-chips mt-3">
          {QUICK_CITIES.map((item) => (
            <button
              key={item.label}
              type="button"
              className="city-search-chip"
              onClick={() => {
                setCountry(item.country);
                setState(item.state);
                setCity(item.city);
                apply(item);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="filter-control">
            <span>Country</span>
            <select
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
                setState("");
                setCity("");
              }}
            >
              <option value="">All countries</option>
              {COUNTRIES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="filter-control">
            <span>State</span>
            <select
              value={state}
              disabled={!country}
              onChange={(event) => {
                setState(event.target.value);
                setCity("");
              }}
            >
              <option value="">{country ? "All states" : "Choose country"}</option>
              {states.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="filter-control">
            <span>City / area</span>
            <select value={city} disabled={!state} onChange={(event) => setCity(event.target.value)}>
              <option value="">{state ? "All areas" : "Choose state"}</option>
              {cities.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        <button type="button" className="btn-primary mt-5 w-full text-sm" onClick={() => apply()}>
          Find profiles
        </button>
      </section>
    </div>
  ) : null;

  return (
    <div className="nav-search">
      <button
        type="button"
        className="nav-search-trigger"
        aria-label="Search profiles"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Search className="h-5 w-5" />
      </button>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </div>
  );
}
