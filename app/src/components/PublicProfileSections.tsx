"use client";

import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  Images,
  Info,
  ListChecks,
  Star,
} from "lucide-react";
import { formatNaira, type ServiceRate } from "@/lib/profileOptions";

type ProfileTab = "about" | "gallery" | "timeline" | "services" | "rates" | "reviews";
type TimelineItem = { title: string; body: string; date: string };
type Review = { author: string; rating: number; body: string; date: string };

export default function PublicProfileSections({
  bio,
  details,
  gallery,
  interests,
  profileName,
  profileViews,
  reviews,
  services,
  timeline,
}: {
  bio: string;
  details: { label: string; value: string }[];
  gallery: string[];
  interests: string[];
  profileName: string;
  profileViews: number;
  reviews: Review[];
  services: ServiceRate[];
  timeline: TimelineItem[];
}) {
  const [active, setActive] = useState<ProfileTab>("about");
  const tabs: { id: ProfileTab; label: string; count?: number; icon: typeof Info }[] = [
    { id: "about", label: "About", icon: Info },
    { id: "gallery", label: "Gallery", count: gallery.length, icon: Images },
    { id: "timeline", label: "Timeline", count: timeline.length, icon: Clock3 },
    { id: "services", label: "Services", count: services.length, icon: ListChecks },
    { id: "rates", label: "Rates", icon: CalendarDays },
    { id: "reviews", label: "Reviews", count: reviews.length, icon: Star },
  ];

  return (
    <div className="mt-5">
      <nav className="profile-section-nav" role="tablist" aria-label="Profile sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            data-active={active === tab.id}
            onClick={() => setActive(tab.id)}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
            {tab.count !== undefined && <span>{tab.count}</span>}
          </button>
        ))}
      </nav>

      {active === "about" && (
        <section className="profile-detail-section mt-3" role="tabpanel">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Profile</p>
              <h2 className="font-display mt-1.5 text-2xl font-bold">About {profileName}</h2>
            </div>
            <p className="flex items-center gap-2 text-sm text-muted">
              <Eye className="h-4 w-4 text-[#df3a6a]" />
              {new Intl.NumberFormat("en-NG").format(profileViews)} views
            </p>
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-white/75">
            {bio || "This member has not written a bio yet."}
          </p>
          {interests.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {interests.map((interest) => <span key={interest} className="filter-chip text-white">{interest}</span>)}
            </div>
          )}
          <dl className="profile-detail-grid mt-7">
            {details.map((detail) => (
              <div key={detail.label} className="profile-detail-item">
                <dt>{detail.label}</dt>
                <dd>{detail.value || "Not specified"}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {active === "gallery" && (
        <section className="profile-detail-section mt-3" role="tabpanel">
          <p className="section-kicker">Media</p>
          <h2 className="font-display mt-1.5 text-2xl font-bold">Gallery</h2>
          {gallery.length > 0 ? (
            <div className="profile-tab-gallery mt-6">
              {gallery.map((photo, index) => (
                <div key={photo}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt={`${profileName} gallery photo ${index + 1}`} loading="lazy" />
                </div>
              ))}
            </div>
          ) : <p className="mt-4 text-sm text-muted">No gallery media yet.</p>}
        </section>
      )}

      {active === "timeline" && (
        <section className="profile-detail-section mt-3" role="tabpanel">
          <p className="section-kicker">Updates</p>
          <h2 className="font-display mt-1.5 text-2xl font-bold">Timeline</h2>
          <div className="profile-timeline mt-6">
            {timeline.map((item) => (
              <article key={`${item.title}-${item.date}`}>
                <i />
                <div><span>{item.date}</span><h3>{item.title}</h3><p>{item.body}</p></div>
              </article>
            ))}
          </div>
        </section>
      )}

      {active === "services" && (
        <section className="profile-detail-section mt-3" role="tabpanel">
          <p className="section-kicker">Bookings</p>
          <h2 className="font-display mt-1.5 text-2xl font-bold">Services</h2>
          {services.length > 0 ? (
            <ul className="profile-service-list mt-6">
              {services.map((service) => <li key={service.name}><CheckCircle2 className="h-4 w-4" /> {service.name}</li>)}
            </ul>
          ) : <p className="mt-4 text-sm text-muted">No published services yet.</p>}
        </section>
      )}

      {active === "rates" && (
        <section className="profile-detail-section mt-3" role="tabpanel">
          <p className="section-kicker">Pricing</p>
          <h2 className="font-display mt-1.5 text-2xl font-bold">Rates (NGN)</h2>
          {services.length > 0 ? (
            <div className="rates-table mt-6" role="table" aria-label="Published rates">
              <div className="rates-row rates-header" role="row"><span>Service</span><span>Incall</span><span>Outcall</span></div>
              {services.map((service) => (
                <div key={service.name} className="rates-row" role="row">
                  <strong>{service.name}</strong><span>{formatNaira(service.incallRate)}</span><span>{formatNaira(service.outcallRate)}</span>
                </div>
              ))}
            </div>
          ) : <p className="mt-4 text-sm text-muted">No published rates yet.</p>}
        </section>
      )}

      {active === "reviews" && (
        <section className="profile-detail-section mt-3" role="tabpanel">
          <div className="section-heading-row">
            <div><p className="section-kicker">Trust</p><h2 className="font-display mt-1.5 text-2xl font-bold">Reviews</h2></div>
            {reviews.length > 0 && <strong className="profile-review-score"><Star className="h-4 w-4 fill-current" /> 4.7</strong>}
          </div>
          {reviews.length > 0 ? (
            <div className="profile-reviews mt-6">
              {reviews.map((review) => (
                <article key={`${review.author}-${review.date}`}>
                  <div>
                    <strong>{review.author}</strong>
                    <span>{Array.from({ length: 5 }, (_, index) => <Star key={index} className={`h-3.5 w-3.5 ${index < review.rating ? "fill-current" : "opacity-25"}`} />)}</span>
                    <small>{review.date}</small>
                  </div>
                  <p>{review.body}</p>
                </article>
              ))}
            </div>
          ) : <p className="mt-4 text-sm text-muted">No public reviews yet.</p>}
        </section>
      )}
    </div>
  );
}
