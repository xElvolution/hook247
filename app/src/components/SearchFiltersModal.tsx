"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import {
  BUILD_OPTIONS,
  COUNTRIES,
  ETHNICITY_OPTIONS,
  GENDER_OPTIONS,
  SERVICE_OPTIONS,
  citiesFor,
  statesFor,
} from "@/lib/profileOptions";

export type BrowseFilters = {
  country: string;
  state: string;
  city: string;
  gender: string;
  minAge: string;
  maxAge: string;
  ethnicity: string;
  bodyBuild: string;
  service: string;
};

export const EMPTY_BROWSE_FILTERS: BrowseFilters = {
  country: "",
  state: "",
  city: "",
  gender: "",
  minAge: "",
  maxAge: "",
  ethnicity: "",
  bodyBuild: "",
  service: "",
};

const AGES = Array.from({ length: 43 }, (_, index) => String(index + 18));

export default function SearchFiltersModal({
  initialFilters,
  onApply,
  onClose,
}: {
  initialFilters: BrowseFilters;
  onApply: (filters: BrowseFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initialFilters);
  const states = statesFor(draft.country);
  const cities = citiesFor(draft.country, draft.state);

  function update<K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function changeCountry(country: string) {
    setDraft((current) => ({ ...current, country, state: "", city: "" }));
  }

  function changeState(state: string) {
    setDraft((current) => ({ ...current, state, city: "" }));
  }

  return (
    <div className="filter-modal-backdrop" onMouseDown={onClose}>
      <section
        className="filter-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-filter-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="filter-modal-header">
          <div>
            <h2 id="search-filter-title" className="font-display text-2xl font-extrabold">
              Search filters
            </h2>
            <p className="mt-1 text-sm text-muted">Refine profiles by location and public details.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close filters">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="filter-modal-body">
          <fieldset>
            <legend className="filter-group-title">Location</legend>
            <div className="filter-form-grid mt-4">
              <label className="filter-control">
                <span>Country</span>
                <select value={draft.country} onChange={(event) => changeCountry(event.target.value)}>
                  <option value="">All countries</option>
                  {COUNTRIES.map((country) => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </label>
              <label className="filter-control">
                <span>State</span>
                <select
                  value={draft.state}
                  disabled={!draft.country}
                  onChange={(event) => changeState(event.target.value)}
                >
                  <option value="">{draft.country ? "All states" : "Choose a country first"}</option>
                  {states.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </label>
              <label className="filter-control">
                <span>City / area</span>
                <select
                  value={draft.city}
                  disabled={!draft.state}
                  onChange={(event) => update("city", event.target.value)}
                >
                  <option value="">{draft.state ? "All cities" : "Choose a state first"}</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset className="filter-group">
            <legend className="filter-group-title">Profile</legend>
            <div className="mt-4">
              <span className="filter-label">Gender</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {GENDER_OPTIONS.map((option) => (
                  <button
                    key={option.value || "all"}
                    type="button"
                    className="filter-choice"
                    data-active={draft.gender === option.value}
                    onClick={() => update("gender", option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-form-grid mt-5">
              <label className="filter-control">
                <span>Minimum age</span>
                <select value={draft.minAge} onChange={(event) => update("minAge", event.target.value)}>
                  <option value="">Any</option>
                  {AGES.map((age) => <option key={age} value={age}>{age}</option>)}
                </select>
              </label>
              <label className="filter-control">
                <span>Maximum age</span>
                <select value={draft.maxAge} onChange={(event) => update("maxAge", event.target.value)}>
                  <option value="">Any</option>
                  {AGES.map((age) => <option key={age} value={age}>{age}</option>)}
                </select>
              </label>
              <label className="filter-control">
                <span>Ethnicity</span>
                <select value={draft.ethnicity} onChange={(event) => update("ethnicity", event.target.value)}>
                  <option value="">Any ethnicity</option>
                  {ETHNICITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="filter-control">
                <span>Build</span>
                <select value={draft.bodyBuild} onChange={(event) => update("bodyBuild", event.target.value)}>
                  <option value="">Any build</option>
                  {BUILD_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset className="filter-group">
            <legend className="filter-group-title">Services</legend>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="service-filter-choice"
                data-active={!draft.service}
                onClick={() => update("service", "")}
              >
                Any service
              </button>
              {SERVICE_OPTIONS.map((service) => (
                <button
                  key={service}
                  type="button"
                  className="service-filter-choice"
                  data-active={draft.service === service}
                  onClick={() => update("service", service)}
                >
                  {service}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <footer className="filter-modal-footer">
          <button type="button" className="btn-ghost" onClick={() => setDraft(EMPTY_BROWSE_FILTERS)}>
            Reset
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            <Search className="h-4 w-4" /> Apply search
          </button>
        </footer>
      </section>
    </div>
  );
}
