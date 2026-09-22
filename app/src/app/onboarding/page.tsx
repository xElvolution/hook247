"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  BUILD_OPTIONS,
  BUST_OPTIONS,
  COUNTRIES,
  EDUCATION_OPTIONS,
  ETHNICITY_OPTIONS,
  ORIENTATION_OPTIONS,
  RATE_PACKAGES,
  SERVICE_OPTIONS,
  SMOKING_OPTIONS,
  THIGH_OPTIONS,
  citiesFor,
  countryInfo,
  statesFor,
  type ServiceRate,
} from "@/lib/profileOptions";
import {
  clampLocal,
  countryDialLabel,
  countryFromStoredWhatsApp,
  isValidLocal,
  toLocalWhatsAppInput,
} from "@/lib/whatsapp";
import MoneyInput from "@/components/MoneyInput";

const GENDERS = [
  { value: "FEMALE", label: "Woman" },
  { value: "MALE", label: "Man" },
  { value: "NONBINARY", label: "Non-binary" },
] as const;



const AVATAR_STYLES = ["adventurer", "lorelei", "avataaars", "micah", "notionists", "thumbs"];
const EMPTY_OFFERS: ServiceRate[] = SERVICE_OPTIONS.map((name) => ({
  name,
  incallRate: null,
  outcallRate: null,
  enabled: false,
}));
const EMPTY_RATES: ServiceRate[] = RATE_PACKAGES.map((name) => ({
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
  bustSize: string;
  thighs: string;
  education: string;
  smoking: string;
  orientation: string;
  availableToday: boolean;
  interests: string[];
  avatarUrl: string;
  photos: string[];
  clips: string[];
  role: "ESCORT" | "CLIENT";
  whatsapp: string;
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
  const [bustSize, setBustSize] = useState("");
  const [thighs, setThighs] = useState("");
  const [education, setEducation] = useState("");
  const [smoking, setSmoking] = useState("");
  const [orientation, setOrientation] = useState("");
  const [availableToday, setAvailableToday] = useState(false);
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [avatarStyle, setAvatarStyle] = useState(AVATAR_STYLES[0]);
  const [existingAvatarUrl, setExistingAvatarUrl] = useState("");
  const [offerings, setOfferings] = useState<ServiceRate[]>(EMPTY_OFFERS);
  const [ratePackages, setRatePackages] = useState<ServiceRate[]>(EMPTY_RATES);
  const [role, setRole] = useState<"ESCORT" | "CLIENT">("ESCORT");
  const [phoneCountry, setPhoneCountry] = useState("Nigeria");
  const [whatsapp, setWhatsapp] = useState("");
  const [offer, setOffer] = useState("");
  const [vibe, setVibe] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [clips, setClips] = useState<string[]>([]);
  const [writingBio, setWritingBio] = useState(false);
  const [bioHistory, setBioHistory] = useState<string[]>([]);
  const [bioVariation, setBioVariation] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);

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
        setBustSize(profile.bustSize ?? "");
        setThighs(profile.thighs ?? "");
        setEducation(profile.education);
        setSmoking(profile.smoking);
        setOrientation(profile.orientation);
        setAvailableToday(profile.availableToday);
        setInterests(profile.interests);
        setExistingAvatarUrl(profile.avatarUrl);
        setPhotos(profile.photos ?? []);
        setClips(profile.clips ?? []);
        setRole(profile.role === "CLIENT" ? "CLIENT" : "ESCORT");
        {
          const inferred = countryFromStoredWhatsApp(profile.whatsapp ?? "", profile.country || "Nigeria");
          setPhoneCountry(inferred);
          setWhatsapp(toLocalWhatsAppInput(profile.whatsapp ?? "", inferred));
        }
        setOfferings(
          EMPTY_OFFERS.map((item) => {
            const saved = profile.services.find((service) => service.name === item.name);
            return saved ? { ...item, enabled: true } : item;
          })
        );
        setRatePackages(
          EMPTY_RATES.map((item) => {
            const saved = profile.services.find((service) => service.name === item.name);
            return saved
              ? { ...item, incallRate: saved.incallRate, outcallRate: saved.outcallRate, enabled: true }
              : item;
          })
        );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (role === "CLIENT" && step > 2) setStep(2);
  }, [role, step]);

  const states = statesFor(country);
  const cities = citiesFor(country, state);
  const avatarUrl = (style: string) =>
    `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(displayName || "hook247")}&backgroundColor=1f1229`;

  const canContinue =
    step === 0
      ? displayName.trim().length >= 2 &&
        !!birthDate &&
        !!country &&
        !!state &&
        !!city &&
        !!role &&
        (role === "CLIENT" || isValidLocal(whatsapp, phoneCountry))
      : step === 1
        ? !!gender &&
          lookingFor.length > 0 &&
          !!ethnicity &&
          !!bodyBuild &&
          !!education &&
          !!smoking &&
          !!orientation &&
          (role === "CLIENT" || (!!bustSize && !!thighs))
        : step === 2
          ? bio.length <= 500
          : step === 3
            ? role === "CLIENT" || offerings.some((service) => service.enabled)
            : role === "CLIENT" ||
              ratePackages.some((pack) => !!pack.incallRate || !!pack.outcallRate);

  function toggle(list: string[], value: string, set: (values: string[]) => void, max = 99) {
    if (list.includes(value)) set(list.filter((item) => item !== value));
    else if (list.length < max) set([...list, value]);
  }

  function updateOffer(index: number, patch: Partial<ServiceRate>) {
    setOfferings((current) =>
      current.map((service, serviceIndex) => (serviceIndex === index ? { ...service, ...patch } : service))
    );
  }

  function updateRate(index: number, patch: Partial<ServiceRate>) {
    setRatePackages((current) =>
      current.map((pack, packIndex) => (packIndex === index ? { ...pack, ...patch } : pack))
    );
  }



  async function writeBio() {
    setWritingBio(true);
    setError("");
    const variation = bioVariation + 1;
    setBioVariation(variation);
    const avoid = [...bioHistory, bio].filter(Boolean).slice(-6);
    try {
      const response = await fetch("/api/bio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: displayName.trim(),
          city: [city, state, country].filter(Boolean).join(", "),
          offer,
          vibe,
          services: offerings.filter((service) => service.enabled).map((service) => service.name),
          avoid,
          variation,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Could not write the bio.");
        return;
      }
      if (data.bio) {
        if (bio.trim()) setBioHistory((current) => [...current, bio].slice(-6));
        setBio(data.bio);
      }
    } catch {
      setError("Could not reach the bio writer. Try again.");
    } finally {
      setWritingBio(false);
    }
  }

  async function uploadAvatar(file: File) {
    setError("");
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Photo upload failed.");
        return;
      }
      if (data.kind !== "image") {
        setError("Use a JPG or PNG photo.");
        return;
      }
      setExistingAvatarUrl(data.url);
      setPhotos((current) => (current.includes(data.url) ? current : [data.url, ...current]));
    } catch {
      setError("Photo upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!canContinue) {
      setError("Complete the required fields before saving.");
      return;
    }
    setBusy(true);
    setError("");
    try {
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
          bustSize,
          thighs,
          education,
          smoking,
          orientation,
          availableToday,
          interests: [],
          avatarUrl: existingAvatarUrl || avatarUrl(avatarStyle),
          photos,
          clips,
          role,
          phoneCountry,
          whatsapp,
          services: [
            ...offerings.filter((service) => service.enabled),
            ...ratePackages
              .filter((pack) => pack.incallRate || pack.outcallRate)
              .map((pack) => ({ ...pack, enabled: true })),
          ],
        }),
        signal: AbortSignal.timeout(25000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "The profile could not be saved.");
        return;
      }
      if (editing) {
        router.push("/profile");
        router.refresh();
        return;
      }
      setCreated(true);
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const panels = [
    <div key="basics" className="setup-grid">
      <div className="setup-span-2">
        <p className="setup-label">I am signing up as</p>
        <div className="role-pick mt-2">
          <button type="button" className="role-pick-card" data-active={role === "ESCORT"} onClick={() => setRole("ESCORT")}>
            <strong>Escort</strong>
            <small>Create a profile and get discovered.</small>
          </button>
          <button type="button" className="role-pick-card" data-active={role === "CLIENT"} onClick={() => setRole("CLIENT")}>
            <strong>Client</strong>
            <small>Browse profiles and connect.</small>
          </button>
        </div>
      </div>
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
        {states.length > 0 ? (
          <select value={state} onChange={(event) => { setState(event.target.value); setCity(""); }}>
            <option value="">Choose state</option>
            {states.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        ) : (
          <input value={state} onChange={(event) => { setState(event.target.value); setCity(""); }} placeholder="State / region" />
        )}
      </label>
      <label className="setup-control">
        <span>City / area</span>
        {cities.length > 0 ? (
          <select value={city} disabled={!state} onChange={(event) => setCity(event.target.value)}>
            <option value="">{state ? "Choose area" : "Choose state first"}</option>
            {cities.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        ) : (
          <input value={city} disabled={!state} onChange={(event) => setCity(event.target.value)} placeholder={state ? "City / area" : "Choose state first"} />
        )}
      </label>
      {role === "ESCORT" && (
        <div className="setup-control setup-span-2">
          <span>WhatsApp number</span>
          <div className="wa-input-row">
            <select
              className="wa-cc-select"
              value={phoneCountry}
              aria-label="WhatsApp country code"
              onChange={(event) => {
                const next = event.target.value;
                setPhoneCountry(next);
                setWhatsapp((current) => clampLocal(current, next));
              }}
            >
              {COUNTRIES.map((option) => (
                <option key={option} value={option}>
                  {countryDialLabel(option)} {countryInfo(option)?.iso || option}
                </option>
              ))}
            </select>
            <input
              value={whatsapp}
              onChange={(event) => setWhatsapp(clampLocal(event.target.value, phoneCountry))}
              placeholder={`${countryInfo(phoneCountry)?.phoneLength ?? 10} digits`}
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={(countryInfo(phoneCountry)?.phoneLength ?? 10) + 1}
            />
          </div>
        </div>
      )}
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
          { label: "Bust size", value: bustSize, set: setBustSize, options: BUST_OPTIONS },
          { label: "Thighs", value: thighs, set: setThighs, options: THIGH_OPTIONS },
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
        <textarea value={bio} maxLength={500} onChange={(event) => setBio(event.target.value)} placeholder="Write a short bio, or tap generate for a new one." />
        <small>{bio.length}/500</small>
      </label>
      <button type="button" className="btn-ghost" disabled={writingBio} onClick={() => void writeBio()}>
        {writingBio ? "Writing a new bio..." : bio.trim() ? "Generate another bio" : "Generate bio with AI"}
      </button>
      <label className="setup-control">
        <span>Profile picture</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadAvatar(file);
            event.target.value = "";
          }}
        />
        <small>Use a JPG or PNG. You can remove it below and pick another.</small>
      </label>
      {existingAvatarUrl && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={existingAvatarUrl} alt="" className="h-20 w-20 rounded-xl object-cover" />
          <button
            type="button"
            className="btn-ghost text-sm"
            onClick={() => {
              setExistingAvatarUrl("");
              setPhotos((current) => current.filter((item) => item !== existingAvatarUrl));
            }}
          >
            Remove photo
          </button>
        </div>
      )}
      {photos.filter((item) => item !== existingAvatarUrl).length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.filter((item) => item !== existingAvatarUrl).map((url) => (
            <div key={url}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="aspect-square w-full rounded-xl object-cover" />
              <button
                type="button"
                className="mt-1 w-full rounded-lg border border-line py-1 text-[11px] font-semibold text-red-300"
                onClick={() => setPhotos((current) => current.filter((item) => item !== url))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
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
      <p className="text-sm text-muted">Tick every service you offer.</p>
      <div className="service-selection-grid">
        {offerings.map((service, index) => (
          <label key={service.name} className="service-select-option" data-enabled={service.enabled}>
            <input type="checkbox" checked={service.enabled} onChange={(event) => updateOffer(index, { enabled: event.target.checked })} />
            <span>{service.name}</span>
            {service.enabled && <Check className="h-4 w-4" />}
          </label>
        ))}
      </div>
    </div>,

    <div key="rates" className="space-y-3">
      <p className="text-sm text-muted">Set Short time, Overnight and Weekend prices. Leave a box blank if you do not offer it.</p>
      {ratePackages.map((pack, index) => (
        <div key={pack.name} className="service-editor" data-enabled="true">
          <div className="service-editor-name">{pack.name}</div>
          <label className="service-rate-input">
            <span>Incall (NGN)</span>
            <MoneyInput
              value={pack.incallRate}
              onChange={(naira) => updateRate(index, { incallRate: naira })}
              placeholder="e.g. 100,000"
            />
          </label>
          <label className="service-rate-input">
            <span>Outcall (NGN)</span>
            <MoneyInput
              value={pack.outcallRate}
              onChange={(naira) => updateRate(index, { outcallRate: naira })}
              placeholder="e.g. 100,000"
            />
          </label>
        </div>
      ))}
    </div>,
  ];

  const headings =
    role === "CLIENT"
      ? ["Basic information", "Personal details", "Bio and photo"]
      : ["Basic information", "Personal details", "Bio and photo", "Services", "Rates"];

  if (created) {
    return (
      <main className="profile-setup-page">
        <section className="profile-setup-shell setup-congrats">
          <div className="setup-congrats-mark">
            <Check className="h-8 w-8" />
          </div>
          <p className="section-kicker">Hooks247</p>
          <h1 className="font-display mt-2 text-3xl font-extrabold">Congratulations</h1>
          <p className="mt-3 text-sm text-muted">
            Your account has been created.
            {role === "CLIENT"
              ? " You can now browse profiles and connect."
              : " Pick a plan next so your profile can go live."}
          </p>
          <button
            type="button"
            className="btn-primary mt-7 w-full"
            onClick={() => {
              router.push(role === "CLIENT" ? "/" : "/premium");
              router.refresh();
            }}
          >
            {role === "CLIENT" ? "Browse profiles" : "Continue to billing"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="profile-setup-page">
      <section className="profile-setup-shell">
        <header className="profile-setup-header">
          <div>
            <p className="section-kicker">{editing ? "Edit profile" : "Create profile"}</p>
            <h1 className="font-display mt-2 text-2xl font-extrabold">{headings[step]}</h1>
          </div>
          <span className="text-xs text-muted">Step {step + 1} of {headings.length}</span>
        </header>

        <div className="setup-progress">
          {headings.map((_, index) => <span key={index} data-active={index <= step} />)}
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
          {step < headings.length - 1 ? (
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
