import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Crown,
  Eye,
  MapPin,
  Pencil,
  Sparkles,
  Zap,
} from "lucide-react";
import { formatNaira } from "@/lib/profileOptions";
import { getCurrentUser, ageFrom } from "@/lib/user";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-detail-item">
      <dt>{label}</dt>
      <dd>{value || "Not specified"}</dd>
    </div>
  );
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signup");
  if (!user.profile) redirect("/onboarding");
  const p = user.profile;
  const age = ageFrom(p.birthDate);
  const location = [p.city, p.state, p.country].filter(Boolean).join(", ");
  const gender = p.gender === "FEMALE" ? "Woman" : p.gender === "MALE" ? "Man" : "Non-binary";
  const services = p.services.filter((service) => service.enabled);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="section-heading-row mb-6 items-end">
        <div>
          <p className="section-kicker">Account</p>
          <h1 className="font-display mt-2 text-2xl font-bold">My profile</h1>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link href={`/profiles/${encodeURIComponent(user.id)}`} className="btn-ghost !px-4 !py-2.5 text-sm">
            <Eye className="h-4 w-4" /> Public view
          </Link>
          <Link href="/onboarding" className="btn-primary !px-4 !py-2.5 text-sm">
            <Pencil className="h-4 w-4" /> Edit profile
          </Link>
        </div>
      </div>

      <div className="public-profile-layout">
        <section className="public-profile-gallery" aria-label="My profile photo">
          <div className="public-profile-photo public-profile-photo-main">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.avatarUrl}
              alt={p.displayName}
              className="h-full w-full object-cover"
            />
            {(p.availableToday || p.boostedAt) && (
              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                {p.availableToday && (
                  <span className="availability-badge">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Available today
                  </span>
                )}
                {p.boostedAt && (
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
            <h2 className="font-display text-3xl font-extrabold">
              {p.displayName}, {age}
            </h2>
            {p.verified && <BadgeCheck className="h-5 w-5 fill-[#df3a6a] text-white" />}
            <span className="filter-chip inline-flex items-center gap-1 !cursor-default !text-xs">
              {p.plan === "FREE" ? (
                "Free"
              ) : p.plan === "PLUS" ? (
                <><Sparkles className="h-3 w-3" /> Plus</>
              ) : (
                <><Crown className="h-3 w-3 text-amber-400" /> Elite</>
              )}
            </span>
          </div>

          {location && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
              <MapPin className="h-4 w-4" /> {location}
            </p>
          )}

          <div className="mt-6 border-t border-line pt-6">
            <h3 className="font-display text-sm font-bold uppercase text-white/75">About</h3>
            <p className="mt-3 text-[15px] leading-7 text-white/75">
              {p.bio || "Add a bio so people know what makes you good company."}
            </p>
          </div>

          {p.interests.length > 0 && (
            <div className="mt-6 border-t border-line pt-6">
              <h3 className="font-display text-sm font-bold uppercase text-white/75">Interests</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {p.interests.map((interest) => (
                  <span key={interest} className="filter-chip text-white">{interest}</span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-6">
            <div className="public-profile-fact">
              <CalendarDays className="h-4 w-4 text-[#df3a6a]" />
              <span>
                <small>Joined</small>
                <strong>{p.createdAt.toLocaleDateString("en", { month: "short", year: "numeric" })}</strong>
              </span>
            </div>
            <div className="public-profile-fact">
              <Eye className="h-4 w-4 text-[#df3a6a]" />
              <span>
                <small>Views</small>
                <strong>{new Intl.NumberFormat("en-NG").format(p.profileViews)}</strong>
              </span>
            </div>
          </div>
        </aside>
      </div>

      <section className="profile-detail-section mt-5">
        <p className="section-kicker">Profile</p>
        <h2 className="font-display mt-1.5 text-2xl font-bold">Personal details</h2>
        <dl className="profile-detail-grid mt-6">
          <Detail label="Gender" value={gender} />
          <Detail label="Age" value={String(age)} />
          <Detail label="Ethnicity" value={p.ethnicity} />
          <Detail label="Build" value={p.bodyBuild} />
          <Detail label="Orientation" value={p.orientation} />
          <Detail label="Education" value={p.education} />
          <Detail label="Smoking" value={p.smoking} />
          <Detail label="Country" value={p.country} />
          <Detail label="State" value={p.state} />
          <Detail label="City / area" value={p.city} />
        </dl>
      </section>

      <section className="profile-detail-section mt-5">
        <p className="section-kicker">Bookings</p>
        <div className="section-heading-row mt-1.5 items-end">
          <h2 className="font-display text-2xl font-bold">Services</h2>
          <Link href="/onboarding" className="section-link">
            <Pencil className="h-3.5 w-3.5" /> Edit services
          </Link>
        </div>

        {services.length > 0 ? (
          <ul className="profile-service-list mt-6">
            {services.map((service) => (
              <li key={service.id}><CheckCircle2 className="h-4 w-4" /> {service.name}</li>
            ))}
          </ul>
        ) : (
          <div className="empty-panel mt-6 px-5 py-8 text-center">
            <p className="text-sm text-muted">You have not published any services yet.</p>
            <Link href="/onboarding" className="btn-primary mt-4 text-sm">
              <Pencil className="h-4 w-4" /> Add services
            </Link>
          </div>
        )}
      </section>

      <section className="profile-detail-section mt-5">
        <p className="section-kicker">Pricing</p>
        <div className="section-heading-row mt-1.5 items-end">
          <h2 className="font-display text-2xl font-bold">Rates (NGN)</h2>
          <Link href="/onboarding" className="section-link">
            <Pencil className="h-3.5 w-3.5" /> Edit rates
          </Link>
        </div>

        {services.length > 0 ? (
          <div className="rates-table mt-6" role="table" aria-label="My services and rates">
            <div className="rates-row rates-header" role="row">
              <span role="columnheader">Service</span>
              <span role="columnheader">Incall</span>
              <span role="columnheader">Outcall</span>
            </div>
            {services.map((service) => (
              <div key={service.id} className="rates-row" role="row">
                <strong role="cell">{service.name}</strong>
                <span role="cell">{formatNaira(service.incallRate)}</span>
                <span role="cell">{formatNaira(service.outcallRate)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">Add services before setting rates.</p>
        )}
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="text-xs text-muted">Signed in as {user.email}</p>
        <div className="flex flex-wrap gap-2">
          {!p.verified && (
            <Link href="/premium" className="btn-ghost !px-4 !py-2.5 text-sm">
              <BadgeCheck className="h-4 w-4" /> Get verified
            </Link>
          )}
          {p.plan === "FREE" && (
            <Link href="/premium" className="btn-primary !px-4 !py-2.5 text-sm">
              <Zap className="h-4 w-4" /> Go Premium
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
