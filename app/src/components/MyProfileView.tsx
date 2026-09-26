"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Crown,
  Eye,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
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
  formatNaira,
  isRatePackage,
  statesFor,
} from "@/lib/profileOptions";
import {
  clampLocal,
  countryDialLabel,
  countryFromStoredWhatsApp,
  formatWhatsApp,
  toLocalWhatsAppInput,
} from "@/lib/whatsapp";
import MoneyInput from "@/components/MoneyInput";
import ProfileMedia from "@/components/ProfileMedia";
import ReferralCard from "@/components/ReferralCard";
import LogoutButton from "@/components/LogoutButton";

export type MyProfileData = {
  userId: string;
  email: string;
  displayName: string;
  bio: string;
  availableToday: boolean;
  birthDate: string;
  gender: "MALE" | "FEMALE" | "NONBINARY";
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
  whatsapp: string;
  role: "ESCORT" | "CLIENT";
  avatarUrl: string;
  photos: string[];
  clips: string[];
  verified: boolean;
  plan: "FREE" | "PLUS" | "ELITE";
  boostedUntil: string | null;
  createdAt: string;
  profileViews: number;
  services: { name: string; incallRate: number | null; outcallRate: number | null; enabled: boolean }[];
};

type Section = "about" | "details" | "photos" | "services" | "rates" | null;

function ageFromIso(iso: string) {
  const birth = new Date(iso);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const month = now.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function genderLabel(gender: MyProfileData["gender"]) {
  if (gender === "FEMALE") return "Woman";
  if (gender === "MALE") return "Man";
  return "Non-binary";
}

export default function MyProfileView({ initial }: { initial: MyProfileData }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [open, setOpen] = useState<Section>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const age = ageFromIso(profile.birthDate);
  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(", ");
  const boosted = profile.boostedUntil ? new Date(profile.boostedUntil) > new Date() : false;
  const offerings = profile.services.filter((service) => !isRatePackage(service.name));
  const rateRows = profile.services.filter((service) => isRatePackage(service.name));
  const escort = profile.role === "ESCORT";

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      if (data.profile) {
        setProfile((current) => ({
          ...current,
          displayName: data.profile.displayName,
          bio: data.profile.bio,
          availableToday: data.profile.availableToday,
          birthDate: data.profile.birthDate?.slice?.(0, 10) || current.birthDate,
          gender: data.profile.gender,
          country: data.profile.country,
          state: data.profile.state,
          city: data.profile.city,
          ethnicity: data.profile.ethnicity,
          bodyBuild: data.profile.bodyBuild,
          bustSize: data.profile.bustSize,
          thighs: data.profile.thighs,
          education: data.profile.education,
          smoking: data.profile.smoking,
          orientation: data.profile.orientation,
          whatsapp: data.profile.whatsapp,
          services: data.profile.services ?? current.services,
        }));
      }
      setOpen(null);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      {!profile.verified ? (
        <div className="verify-banner mb-5">
          <div>
            <p className="verify-banner-kicker">No verified badge yet</p>
            <p className="verify-banner-copy">
              Get verified so clients can trust this profile. The badge shows on your photos, cards, and public page.
            </p>
          </div>
          <Link href="/premium" className="btn-primary shrink-0 text-sm">
            <BadgeCheck className="h-4 w-4" /> Get verified
          </Link>
        </div>
      ) : null}

      <div className="section-heading-row mb-6 items-end">
        <div>
          <p className="section-kicker">Account</p>
          <h1 className="font-display mt-1.5 text-xl font-bold">My profile</h1>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/feed?compose=1" className="btn-primary !px-4 !py-2.5 text-sm">
            <Plus className="h-4 w-4" /> Create post
          </Link>
          <Link href={`/profiles/${encodeURIComponent(profile.userId)}`} className="btn-ghost !px-4 !py-2.5 text-sm">
            <Eye className="h-4 w-4" /> Public view
          </Link>
          <LogoutButton />
        </div>
      </div>

      <div className="public-profile-layout">
        <section className="public-profile-gallery" aria-label="My profile photo">
          <div className="public-profile-photo public-profile-photo-main">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.avatarUrl} alt={profile.displayName} className="h-full w-full object-cover" />
            <button type="button" className="edit-chip" onClick={() => setOpen("photos")}>
              <Pencil className="h-3.5 w-3.5" /> Edit photos
            </button>
            {(profile.availableToday || boosted) && (
              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                {profile.availableToday && (
                  <span className="availability-badge">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Available today
                  </span>
                )}
                {boosted && (
                  <span className="boost-badge">
                    <Zap className="h-3 w-3 fill-current" /> Boosted
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        <aside className="public-profile-panel">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-extrabold">
              {profile.displayName}, {age}
            </h2>
            {profile.verified && <BadgeCheck className="h-5 w-5 fill-[#df3a6a] text-white" />}
            <span className="filter-chip inline-flex items-center gap-1 !cursor-default !text-xs">
              {profile.plan === "FREE" ? "Free" : profile.plan === "PLUS" ? (
                <><Sparkles className="h-3 w-3" /> Plus</>
              ) : (
                <><Crown className="h-3 w-3 text-amber-400" /> Elite</>
              )}
            </span>
            <button type="button" className="section-link ml-auto" onClick={() => setOpen("about")}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          </div>
          {location && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
              <MapPin className="h-4 w-4" /> {location}
            </p>
          )}
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="font-display text-sm font-bold uppercase text-white/75">About</h3>
            <p className="mt-2 text-sm leading-6 text-white/75">
              {profile.bio || "Add a bio so clients know what you offer."}
            </p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4">
            <div className="public-profile-fact">
              <CalendarDays className="h-4 w-4 text-[#df3a6a]" />
              <span>
                <small>Joined</small>
                <strong>{new Date(profile.createdAt).toLocaleDateString("en", { month: "short", year: "numeric" })}</strong>
              </span>
            </div>
            <div className="public-profile-fact">
              <Eye className="h-4 w-4 text-[#df3a6a]" />
              <span>
                <small>Views</small>
                <strong>{new Intl.NumberFormat("en-NG").format(profile.profileViews)}</strong>
              </span>
            </div>
          </div>
        </aside>
      </div>

      <section className="profile-detail-section mt-5">
        <div className="section-heading-row items-end">
          <div>
            <p className="section-kicker">Profile</p>
            <h2 className="font-display mt-1.5 text-xl font-bold">Personal details</h2>
          </div>
          <button type="button" className="section-link" onClick={() => setOpen("details")}>
            <Pencil className="h-3.5 w-3.5" /> Edit details
          </button>
        </div>
        <dl className="profile-detail-grid mt-5">
          <Item label="Gender" value={genderLabel(profile.gender)} />
          <Item label="Age" value={String(age)} />
          <Item label="Ethnicity" value={profile.ethnicity} />
          <Item label="Build" value={profile.bodyBuild} />
          <Item label="Bust size" value={profile.bustSize || "Not added"} />
          <Item label="Thighs" value={profile.thighs || "Not added"} />
          <Item label="Orientation" value={profile.orientation} />
          <Item label="Education" value={profile.education} />
          <Item label="Smoking" value={profile.smoking} />
          <Item label="Country" value={profile.country} />
          <Item label="State" value={profile.state} />
          <Item label="City / area" value={profile.city} />
          <Item label="Account" value={escort ? "Escort" : "Client"} />
          <Item label="WhatsApp" value={profile.whatsapp ? formatWhatsApp(profile.whatsapp, profile.country) : "Not added"} />
        </dl>
      </section>

      {escort ? (
        <>
          <section className="profile-detail-section mt-5">
            <div className="section-heading-row items-end">
              <div>
                <p className="section-kicker">Bookings</p>
                <h2 className="font-display mt-1.5 text-xl font-bold">Services</h2>
              </div>
              <button type="button" className="section-link" onClick={() => setOpen("services")}>
                <Pencil className="h-3.5 w-3.5" /> Edit services
              </button>
            </div>
            {offerings.length > 0 ? (
              <ul className="profile-service-list mt-5">
                {offerings.map((service) => (
                  <li key={service.name}><CheckCircle2 className="h-4 w-4" /> {service.name}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted">You have not published any services yet.</p>
            )}
          </section>

          <section className="profile-detail-section mt-5">
            <div className="section-heading-row items-end">
              <div>
                <p className="section-kicker">Pricing</p>
                <h2 className="font-display mt-1.5 text-xl font-bold">Rates (NGN)</h2>
              </div>
              <button type="button" className="section-link" onClick={() => setOpen("rates")}>
                <Pencil className="h-3.5 w-3.5" /> Edit rates
              </button>
            </div>
            {rateRows.length > 0 ? (
              <div className="rates-table mt-5" role="table">
                <div className="rates-row rates-header" role="row">
                  <span>Service</span><span>Incall</span><span>Outcall</span>
                </div>
                {rateRows.map((service) => (
                  <div key={service.name} className="rates-row" role="row">
                    <strong>{service.name}</strong>
                    <span>{formatNaira(service.incallRate)}</span>
                    <span>{formatNaira(service.outcallRate)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">Set Short time, Overnight or Weekend rates.</p>
            )}
          </section>
        </>
      ) : null}

      <ReferralCard />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="text-xs text-muted">Signed in as {profile.email}</p>
        <div className="flex flex-wrap gap-2">
          {!profile.verified && (
            <Link href="/premium" className="btn-ghost !px-4 !py-2.5 text-sm">
              <BadgeCheck className="h-4 w-4" /> Get verified
            </Link>
          )}
          {profile.plan === "FREE" && (
            <Link href="/premium" className="btn-primary !px-4 !py-2.5 text-sm">
              <Zap className="h-4 w-4" /> Go Premium
            </Link>
          )}
        </div>
      </div>

      {open === "about" ? (
        <AboutSheet
          profile={profile}
          busy={busy}
          error={error}
          onClose={() => setOpen(null)}
          onSave={(payload) => void save(payload)}
        />
      ) : null}
      {open === "details" ? (
        <DetailsSheet
          profile={profile}
          busy={busy}
          error={error}
          onClose={() => setOpen(null)}
          onSave={(payload) => void save(payload)}
        />
      ) : null}
      {open === "photos" ? (
        <Sheet title="Photos and clips" onClose={() => setOpen(null)}>
          <ProfileMedia avatarUrl={profile.avatarUrl} photos={profile.photos} clips={profile.clips} />
        </Sheet>
      ) : null}
      {open === "services" ? (
        <ServicesSheet
          profile={profile}
          busy={busy}
          error={error}
          onClose={() => setOpen(null)}
          onSave={(payload) => void save(payload)}
        />
      ) : null}
      {open === "rates" ? (
        <RatesSheet
          profile={profile}
          busy={busy}
          error={error}
          onClose={() => setOpen(null)}
          onSave={(payload) => void save(payload)}
        />
      ) : null}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-detail-item">
      <dt>{label}</dt>
      <dd>{value || "Not specified"}</dd>
    </div>
  );
}

function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="edit-sheet-backdrop" onClick={onClose}>
      <section className="edit-sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="mt-4">{children}</div>
      </section>
    </div>
  );
}

function AboutSheet({
  profile,
  busy,
  error,
  onClose,
  onSave,
}: {
  profile: MyProfileData;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [availableToday, setAvailableToday] = useState(profile.availableToday);
  return (
    <Sheet title="Edit name and bio" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ section: "about", displayName, bio, availableToday });
        }}
      >
        <label className="setup-control">
          <span>Display name</span>
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={40} />
        </label>
        <label className="setup-control">
          <span>Bio</span>
          <textarea value={bio} maxLength={500} onChange={(event) => setBio(event.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={availableToday} onChange={(event) => setAvailableToday(event.target.checked)} />
          Available today
        </label>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button type="submit" className="btn-primary w-full text-sm" disabled={busy}>
          {busy ? "Saving..." : "Save"}
        </button>
      </form>
    </Sheet>
  );
}

function DetailsSheet({
  profile,
  busy,
  error,
  onClose,
  onSave,
}: {
  profile: MyProfileData;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [birthDate, setBirthDate] = useState(profile.birthDate);
  const [gender, setGender] = useState(profile.gender);
  const [country, setCountry] = useState(profile.country);
  const [state, setState] = useState(profile.state);
  const [city, setCity] = useState(profile.city);
  const [ethnicity, setEthnicity] = useState(profile.ethnicity);
  const [bodyBuild, setBodyBuild] = useState(profile.bodyBuild);
  const [bustSize, setBustSize] = useState(profile.bustSize);
  const [thighs, setThighs] = useState(profile.thighs);
  const [education, setEducation] = useState(profile.education);
  const [smoking, setSmoking] = useState(profile.smoking);
  const [orientation, setOrientation] = useState(profile.orientation);
  const [phoneCountry, setPhoneCountry] = useState(countryFromStoredWhatsApp(profile.whatsapp, profile.country));
  const [whatsapp, setWhatsapp] = useState(toLocalWhatsAppInput(profile.whatsapp, countryFromStoredWhatsApp(profile.whatsapp, profile.country)));
  const states = statesFor(country);
  const cities = citiesFor(country, state);
  const escort = profile.role === "ESCORT";

  return (
    <Sheet title="Edit personal details" onClose={onClose}>
      <form
        className="setup-grid"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            section: "details",
            birthDate,
            gender,
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
            phoneCountry,
            whatsapp,
          });
        }}
      >
        <label className="setup-control">
          <span>Birth date</span>
          <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} required />
        </label>
        <label className="setup-control">
          <span>Gender</span>
          <select value={gender} onChange={(event) => setGender(event.target.value as MyProfileData["gender"])}>
            <option value="FEMALE">Woman</option>
            <option value="MALE">Man</option>
            <option value="NONBINARY">Non-binary</option>
          </select>
        </label>
        <label className="setup-control">
          <span>Country</span>
          <select value={country} onChange={(event) => { setCountry(event.target.value); setState(""); setCity(""); }}>
            {COUNTRIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="setup-control">
          <span>State</span>
          {states.length ? (
            <select value={state} onChange={(event) => { setState(event.target.value); setCity(""); }}>
              <option value="">Choose state</option>
              {states.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          ) : (
            <input value={state} onChange={(event) => setState(event.target.value)} />
          )}
        </label>
        <label className="setup-control">
          <span>City</span>
          {cities.length ? (
            <select value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="">Choose city</option>
              {cities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          ) : (
            <input value={city} onChange={(event) => setCity(event.target.value)} />
          )}
        </label>
        <Select label="Ethnicity" value={ethnicity} onChange={setEthnicity} options={ETHNICITY_OPTIONS} />
        <Select label="Build" value={bodyBuild} onChange={setBodyBuild} options={BUILD_OPTIONS} />
        {escort ? <Select label="Bust" value={bustSize} onChange={setBustSize} options={BUST_OPTIONS} /> : null}
        {escort ? <Select label="Thighs" value={thighs} onChange={setThighs} options={THIGH_OPTIONS} /> : null}
        <Select label="Education" value={education} onChange={setEducation} options={EDUCATION_OPTIONS} />
        <Select label="Smoking" value={smoking} onChange={setSmoking} options={SMOKING_OPTIONS} />
        <Select label="Orientation" value={orientation} onChange={setOrientation} options={ORIENTATION_OPTIONS} />
        {escort ? (
          <div className="setup-control setup-span-2">
            <span>WhatsApp</span>
            <div className="wa-input-row">
              <select
                className="wa-cc-select"
                value={phoneCountry}
                onChange={(event) => {
                  const next = event.target.value;
                  setPhoneCountry(next);
                  setWhatsapp((current) => clampLocal(current, next));
                }}
              >
                {COUNTRIES.map((item) => (
                  <option key={item} value={item}>
                    {countryDialLabel(item)} {countryInfo(item)?.iso || item}
                  </option>
                ))}
              </select>
              <input
                value={whatsapp}
                onChange={(event) => setWhatsapp(clampLocal(event.target.value, phoneCountry))}
                inputMode="numeric"
              />
            </div>
          </div>
        ) : null}
        {error ? <p className="setup-span-2 text-sm text-red-300">{error}</p> : null}
        <button type="submit" className="btn-primary setup-span-2 text-sm" disabled={busy}>
          {busy ? "Saving..." : "Save details"}
        </button>
      </form>
    </Sheet>
  );
}

function ServicesSheet({
  profile,
  busy,
  error,
  onClose,
  onSave,
}: {
  profile: MyProfileData;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [names, setNames] = useState(
    profile.services.filter((service) => !isRatePackage(service.name)).map((service) => service.name)
  );
  function toggle(name: string) {
    setNames((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  }
  return (
    <Sheet title="Edit services" onClose={onClose}>
      <div className="service-selection-grid">
        {SERVICE_OPTIONS.map((name) => (
          <button
            key={name}
            type="button"
            className="service-select-option"
            data-active={names.includes(name)}
            onClick={() => toggle(name)}
          >
            {name}
          </button>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <button
        type="button"
        className="btn-primary mt-4 w-full text-sm"
        disabled={busy}
        onClick={() => onSave({ section: "services", names })}
      >
        {busy ? "Saving..." : "Save services"}
      </button>
    </Sheet>
  );
}

function RatesSheet({
  profile,
  busy,
  error,
  onClose,
  onSave,
}: {
  profile: MyProfileData;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [packages, setPackages] = useState(
    RATE_PACKAGES.map((name) => {
      const current = profile.services.find((service) => service.name === name);
      return { name, incallRate: current?.incallRate ?? null, outcallRate: current?.outcallRate ?? null };
    })
  );
  return (
    <Sheet title="Edit rates" onClose={onClose}>
      <div className="space-y-3">
        {packages.map((pack, index) => (
          <div key={pack.name} className="service-rate-card">
            <p className="font-semibold">{pack.name}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="service-rate-input">
                <span>Incall</span>
                <MoneyInput
                  value={pack.incallRate}
                  onChange={(naira) =>
                    setPackages((current) => current.map((item, i) => (i === index ? { ...item, incallRate: naira } : item)))
                  }
                  placeholder="e.g. 100,000"
                />
              </label>
              <label className="service-rate-input">
                <span>Outcall</span>
                <MoneyInput
                  value={pack.outcallRate}
                  onChange={(naira) =>
                    setPackages((current) => current.map((item, i) => (i === index ? { ...item, outcallRate: naira } : item)))
                  }
                  placeholder="e.g. 100,000"
                />
              </label>
            </div>
          </div>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <button
        type="button"
        className="btn-primary mt-4 w-full text-sm"
        disabled={busy}
        onClick={() => onSave({ section: "rates", packages })}
      >
        {busy ? "Saving..." : "Save rates"}
      </button>
    </Sheet>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <label className="setup-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}
