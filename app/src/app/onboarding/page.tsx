"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  BUILD_OPTIONS,
  COUNTRIES,
  EDUCATION_OPTIONS,
  ETHNICITY_OPTIONS,
  ORIENTATION_OPTIONS,
  SERVICE_OPTIONS,
  SMOKING_OPTIONS,
  citiesFor,
  statesFor,
  type ServiceRate,
} from "@/lib/profileOptions";

const GENDERS = [
  { value: "FEMALE", label: "Woman" },
  { value: "MALE", label: "Man" },
  { value: "NONBINARY", label: "Non-binary" },
] as const;

const INTERESTS = [
  "Afrobeats", "Nightlife", "Foodie", "Gym", "Movies", "Gaming", "Travel",
  "Art", "Tech", "Fashion", "Football", "Faith", "Music", "Books", "Dancing",
];

const AVATAR_STYLES = ["adventurer", "lorelei", "avataaars", "micah", "notionists", "thumbs"];
const EMPTY_SERVICES: ServiceRate[] = SERVICE_OPTIONS.map((name) => ({
  name,
  incallRate: null,
  outcallRate: null,
  enabled: false,
}));

type ExistingProfile = {
  displayName: string;
  birthDate: string;
  gender: string;
  lookingFor: string[];
  bio: string;
  country: string;
  state: string;
  city: string;
  ethnicity: string;
  bodyBuild: string;
  education: string;
  smoking: string;
  orientation: string;
  availableToday: boolean;
  interests: string[];
  avatarUrl: string;
  services: ServiceRate[];
};

function ProfileSetup() {
  const router = useRouter();
  const search = useSearchParams();
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [birthDate, setBirthDate] = useState(search.get("birth") ?? "");
  const [country, setCountry] = useState("Nigeria");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [gender, setGender] = useState("");
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [ethnicity, setEthnicity] = useState("");
  const [bodyBuild, setBodyBuild] = useState("");
  const [education, setEducation] = useState("");
  const [smoking, setSmoking] = useState("");
  const [orientation, setOrientation] = useState("");
  const [availableToday, setAvailableToday] = useState(false);
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [avatarStyle, setAvatarStyle] = useState(AVATAR_STYLES[0]);
  const [existingAvatarUrl, setExistingAvatarUrl] = useState("");
  const [services, setServices] = useState<ServiceRate[]>(EMPTY_SERVICES);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/onboarding", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { profile?: ExistingProfile } | null) => {
        const profile = data?.profile;
        if (!profile) return;
        setEditing(true);
        setDisplayName(profile.displayName);
        setBirthDate(new Date(profile.birthDate).toISOString().slice(0, 10));
        setGender(profile.gender);
        setLookingFor(profile.lookingFor);
        setBio(profile.bio);
        setCountry(profile.country || "Nigeria");
        setState(profile.state);
        setCity(profile.city);
        setEthnicity(profile.ethnicity);
        setBodyBuild(profile.bodyBuild);
        setEducation(profile.education);
        setSmoking(profile.smoking);
        setOrientation(profile.orientation);
        setAvailableToday(profile.availableToday);
        setInterests(profile.interests);
        setExistingAvatarUrl(profile.avatarUrl);
        setServices(
          EMPTY_SERVICES.map((item) => {
            const saved = profile.services.find((service) => service.name === item.name);
            return saved ? { ...item, ...saved, enabled: true } : item;
          })
        );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const states = statesFor(country);
  const cities = citiesFor(country, state);
  const avatarUrl = (style: string) =>
    `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(displayName || "hook247")}&backgroundColor=1f1229`;

  const canContinue =
    step === 0
      ? displayName.trim().length >= 2 && !!birthDate && !!country && !!state && !!city
      : step === 1
        ? !!gender && lookingFor.length > 0 && !!ethnicity && !!bodyBuild && !!education && !!smoking && !!orientation
        : step === 2
          ? bio.length <= 500
          : step === 3
            ? services.some((service) => service.enabled)
            : services.every((service) => !service.enabled || !!service.incallRate || !!service.outcallRate);

  function toggle(list: string[], value: string, set: (values: string[]) => void, max = 99) {
    if (list.includes(value)) set(list.filter((item) => item !== value));
    else if (list.length < max) set([...list, value]);
  }

  function updateService(index: number, patch: Partial<ServiceRate>) {
    setServices((current) =>
      current.map((service, serviceIndex) => serviceIndex === index ? { ...service, ...patch } : service)
    );
  }

  function rateValue(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  async function finish() {
    if (!canContinue) {
      setError("Complete the required fields before saving.");
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: displayName.trim(),
        birthDate,
        gender,
        lookingFor,
        bio,
        country,
        state,
        city,
        ethnicity,
        bodyBuild,
        education,
        smoking,
        orientation,
        availableToday,
        interests,
        avatarUrl: existingAvatarUrl || avatarUrl(avatarStyle),
        services,
      }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? "The profile could not be saved.");
      return;
    }
    router.push(editing ? "/profile" : "/discover");
    router.refresh();
  }

  const panels = [
    <div key="basics" className="setup-grid">
      <label className="setup-control setup-span-2">
        <span>Display name</span>
        <input value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} placeholder="What should people call you?" />
      </label>
      <label className="setup-control">
        <span>Date of birth</span>
        <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
      </label>
      <label className="setup-control">
        <span>Country</span>
        <select value={country} onChange={(event) => { setCountry(event.target.value); setState(""); setCity(""); }}>
          {COUNTRIES.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label className="setup-control">
        <span>State</span>
        <select value={state} onChange={(event) => { setState(event.target.value); setCity(""); }}>
          <option value="">Choose state</option>
          {states.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label className="setup-control">
        <span>City / area</span>
        <select value={city} disabled={!state} onChange={(event) => setCity(event.target.value)}>
          <option value="">{state ? "Choose city" : "Choose state first"}</option>
          {cities.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label className="setup-toggle setup-span-2">
        <input type="checkbox" checked={availableToday} onChange={(event) => setAvailableToday(event.target.checked)} />
        <span>
          <strong>Available today</strong>
          <small>Show my profile to people filtering for availability today.</small>
        </span>
      </label>
    </div>,

    <div key="details" className="space-y-6">
      <div>
        <p className="setup-label">I am a</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {GENDERS.map((option) => (
            <button key={option.value} type="button" className="filter-choice" data-active={gender === option.value} onClick={() => setGender(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="setup-label">Show me</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {GENDERS.map((option) => (
            <button key={option.value} type="button" className="filter-choice" data-active={lookingFor.includes(option.value)} onClick={() => toggle(lookingFor, option.value, setLookingFor)}>
              {option.label === "Woman" ? "Women" : option.label === "Man" ? "Men" : option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="setup-grid">
        {[
          { label: "Ethnicity", value: ethnicity, set: setEthnicity, options: ETHNICITY_OPTIONS },
          { label: "Build", value: bodyBuild, set: setBodyBuild, options: BUILD_OPTIONS },
          { label: "Education", value: education, set: setEducation, options: EDUCATION_OPTIONS },
          { label: "Smoking", value: smoking, set: setSmoking, options: SMOKING_OPTIONS },
          { label: "Orientation", value: orientation, set: setOrientation, options: ORIENTATION_OPTIONS },
        ].map((field) => (
          <label key={field.label} className="setup-control">
            <span>{field.label}</span>
            <select value={field.value} onChange={(event) => field.set(event.target.value)}>
              <option value="">Choose...</option>
              {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        ))}
      </div>
    </div>,

    <div key="personality" className="space-y-6">
      <label className="setup-control">
        <span>Bio</span>
        <textarea value={bio} maxLength={500} onChange={(event) => setBio(event.target.value)} placeholder="Describe your personality and what makes good company for you." />
        <small>{bio.length}/500</small>
      </label>
      <div>
        <p className="setup-label">Interests <span className="text-muted">(up to 6)</span></p>
        <div className="mt-2 flex flex-wrap gap-2">
          {INTERESTS.map((interest) => (
            <button key={interest} type="button" className="filter-choice" data-active={interests.includes(interest)} onClick={() => toggle(interests, interest, setInterests, 6)}>
              {interest}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="setup-label">Profile photo style</p>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {AVATAR_STYLES.map((style) => (
            <button key={style} type="button" onClick={() => { setAvatarStyle(style); setExistingAvatarUrl(""); }} className="avatar-choice" data-active={!existingAvatarUrl && avatarStyle === style}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarUrl(style)} alt={style} />
            </button>
          ))}
        </div>
      </div>
    </div>,

    <div key="services" className="space-y-4">
      <p className="text-sm text-muted">Choose every service that should appear on your public profile.</p>
      <div className="service-selection-grid">
        {services.map((service, index) => (
          <label key={service.name} className="service-select-option" data-enabled={service.enabled}>
            <input type="checkbox" checked={service.enabled} onChange={(event) => updateService(index, { enabled: event.target.checked })} />
            <span>{service.name}</span>
            {service.enabled && <Check className="h-4 w-4" />}
          </label>
        ))}
      </div>
    </div>,

    <div key="rates" className="space-y-3">
      <p className="text-sm text-muted">Set at least one NGN rate for each selected service. Leave incall or outcall blank when it is not offered.</p>
      {services.filter((service) => service.enabled).map((service) => {
        const index = services.findIndex((item) => item.name === service.name);
        return (
        <div key={service.name} className="service-editor" data-enabled="true">
          <div className="service-editor-name">{service.name}</div>
          <label className="service-rate-input">
            <span>Incall (NGN)</span>
            <input type="number" min="1000" step="1000" value={service.incallRate ?? ""} onChange={(event) => updateService(index, { incallRate: rateValue(event.target.value) })} placeholder="Not offered" />
          </label>
          <label className="service-rate-input">
            <span>Outcall (NGN)</span>
            <input type="number" min="1000" step="1000" value={service.outcallRate ?? ""} onChange={(event) => updateService(index, { outcallRate: rateValue(event.target.value) })} placeholder="Not offered" />
          </label>
        </div>
      )})}
    </div>,
  ];

  const headings = ["Basic information", "Personal details", "Bio and interests", "Services", "Rates"];

  return (
    <main className="profile-setup-page">
      <section className="profile-setup-shell">
        <header className="profile-setup-header">
          <div>
            <p className="section-kicker">{editing ? "Edit profile" : "Create profile"}</p>
            <h1 className="font-display mt-2 text-2xl font-extrabold">{headings[step]}</h1>
          </div>
          <span className="text-xs text-muted">Step {step + 1} of {panels.length}</span>
        </header>

        <div className="setup-progress">
          {panels.map((_, index) => <span key={index} data-active={index <= step} />)}
        </div>

        <div className="profile-setup-body">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22 }}>
              {panels[step]}
            </motion.div>
          </AnimatePresence>
          {error && <p className="mt-5 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
        </div>

        <footer className="profile-setup-footer">
          <button type="button" className="btn-ghost" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          {step < panels.length - 1 ? (
            <button type="button" className="btn-primary" disabled={!canContinue} onClick={() => setStep((current) => current + 1)}>
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" className="btn-primary" disabled={busy || !canContinue} onClick={finish}>
              <Check className="h-4 w-4" /> {busy ? "Saving..." : editing ? "Save profile" : "Publish profile"}
            </button>
          )}
        </footer>
      </section>
    </main>
  );
}

export default function OnboardingPage() {
  return <Suspense><ProfileSetup /></Suspense>;
}
