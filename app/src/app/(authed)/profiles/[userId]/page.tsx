import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Eye,
  Flame,
  MapPin,
  Radio,
  ShieldCheck,
  Users,
} from "lucide-react";
import PublicProfileActions from "@/components/PublicProfileActions";
import PublicProfileSections from "@/components/PublicProfileSections";
import ProfileHeroCarousel from "@/components/ProfileHeroCarousel";
import { db } from "@/lib/db";
import type { PublicProfile } from "@/lib/publicProfile";
import { getSessionUserId } from "@/lib/session";
import { ageFrom } from "@/lib/user";
import { VISIBLE_PROFILE } from "@/lib/moderation";
import { isMockUserId, mockPublicProfile } from "@/lib/mock";

const ONLINE_WINDOW_MS = 30 * 60 * 1000;

const getPublicProfile = cache(async (userId: string): Promise<PublicProfile | null> => {
  if (isMockUserId(userId)) {
    const mocked = mockPublicProfile(userId);
    return mocked;
  }
  // A banned account's profile 404s rather than rendering: the page is public,
  // so it would otherwise stay reachable and indexable after the ban.
  const profile = await db.profile.findFirst({
    where: { AND: [VISIBLE_PROFILE, { userId }] },
    include: { services: { where: { enabled: true }, orderBy: { name: "asc" } } },
  });
  if (!profile) return null;

  return {
    role: profile.role,
    userId: profile.userId,
    displayName: profile.displayName,
    age: ageFrom(profile.birthDate),
    gender: profile.gender,
    country: profile.country,
    state: profile.state,
    city: profile.city,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    photos: profile.photos,
    clips: profile.clips,
    whatsapp: profile.whatsapp,
    interests: profile.interests,
    ethnicity: profile.ethnicity,
    bodyBuild: profile.bodyBuild,
    bustSize: profile.bustSize,
    thighs: profile.thighs,
    education: profile.education,
    smoking: profile.smoking,
    orientation: profile.orientation,
    services: profile.services,
    verified: profile.verified,
    boosted: !!profile.boostedAt,
    online: Date.now() - profile.lastActive.getTime() < ONLINE_WINDOW_MS,
    availableToday: profile.availableToday,
    live: profile.isLive,
    profileViews: profile.profileViews,
    joinedAt: profile.createdAt,
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const profile = await getPublicProfile(userId);
  if (!profile) return { title: "Profile not found | Hook247" };

  return {
    title: `${profile.displayName}, ${profile.age} | Hook247`,
    description: profile.bio || `View ${profile.displayName}'s public Hook247 profile.`,
  };
}

function genderLabel(gender: PublicProfile["gender"]) {
  if (gender === "FEMALE") return "Woman";
  if (gender === "MALE") return "Man";
  return "Non-binary";
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const profile = await getPublicProfile(userId);
  if (!profile) notFound();

  const sessionUserId = await getSessionUserId();
  const realMember = sessionUserId && !isMockUserId(sessionUserId) && !isMockUserId(profile.userId);
  const [followerCount, following] = isMockUserId(profile.userId)
    ? [0, false]
    : await Promise.all([
        db.follow.count({ where: { followingId: profile.userId, follower: { bannedAt: null } } }).catch(() => 0),
        realMember && sessionUserId !== profile.userId
          ? db.follow
              .findUnique({ where: { followerId_followingId: { followerId: sessionUserId, followingId: profile.userId } }, select: { id: true } })
              .then((row) => !!row)
              .catch(() => false)
          : Promise.resolve(false),
      ]);
  const gallery = Array.from(
    new Set([profile.avatarUrl, ...profile.photos, ...profile.clips].filter(Boolean))
  );
  const timeline = [
    ...(profile.availableToday
      ? [{ title: "Available today", body: `${profile.displayName} is accepting enquiries today.`, date: "Today" }]
      : []),
    {
      title: "Services updated",
      body: profile.services.length
        ? `${profile.services.length} services are currently published on this profile.`
        : "No services have been published yet.",
      date: "This week",
    },
    {
      title: "Joined Hook247",
      body: `${profile.displayName} became part of the Hook247 community.`,
      date: profile.joinedAt.toLocaleDateString("en", { month: "short", year: "numeric" }),
    },
  ];
  const reviews: Array<{ author: string; rating: number; body: string; date: string }> = [];
  const details = [
    { label: "Gender", value: genderLabel(profile.gender) },
    { label: "Age", value: String(profile.age) },
    { label: "Ethnicity", value: profile.ethnicity },
    { label: "Build", value: profile.bodyBuild },
    { label: "Bust size", value: profile.bustSize },
    { label: "Thighs", value: profile.thighs },
    { label: "Orientation", value: profile.orientation },
    { label: "Education", value: profile.education },
    { label: "Smoking", value: profile.smoking },
    { label: "Country", value: profile.country },
    { label: "State", value: profile.state },
    { label: "City / area", value: profile.city },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/" className="section-link mb-5">
        <ArrowLeft className="h-4 w-4" /> Back to profiles
      </Link>

      <ProfileHeroCarousel
        items={gallery.length ? gallery : [profile.avatarUrl]}
        name={profile.displayName}
        availableLabel={
          profile.availableToday ? "Available today" : profile.online ? "Online now" : undefined
        }
      />

      <section className="public-profile-summary public-profile-summary-body">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-extrabold md:text-3xl">
              {profile.displayName}, {profile.age}
            </h1>
            {profile.verified && (
              <BadgeCheck
                className="h-5 w-5 shrink-0 fill-[#df3a6a] text-white"
                aria-label="Verified profile"
              />
            )}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
            <MapPin className="h-4 w-4" />
            {[profile.city, profile.state, profile.country].filter(Boolean).join(", ")}
          </p>
          <div className="public-profile-facts mt-5">
            <div className="public-profile-fact">
              <CalendarDays className="h-4 w-4 text-[#df3a6a]" />
              <span>
                <small>Joined</small>
                <strong>{profile.joinedAt.toLocaleDateString("en", { month: "short", year: "numeric" })}</strong>
              </span>
            </div>
            <div className="public-profile-fact">
              <ShieldCheck className="h-4 w-4 text-[#df3a6a]" />
              <span>
                <small>Profile</small>
                <strong>{profile.verified ? "Verified" : "Standard"}</strong>
              </span>
            </div>
            <div className="public-profile-fact">
              <Eye className="h-4 w-4 text-[#df3a6a]" />
              <span><small>Views</small><strong>{new Intl.NumberFormat("en-NG").format(profile.profileViews)}</strong></span>
            </div>
            <div className="public-profile-fact">
              <Users className="h-4 w-4 text-[#df3a6a]" />
              <span><small>Followers</small><strong>{new Intl.NumberFormat("en-NG").format(followerCount)}</strong></span>
            </div>
          </div>
        </div>

        <div className="public-profile-summary-actions">
          {profile.boosted && <span className="boost-badge"><Flame className="h-3 w-3 fill-current" /> Featured</span>}
          {profile.live && (
            <Link href={`/live/${encodeURIComponent(profile.userId)}`} className="btn-primary w-full text-sm">
              <Radio className="h-4 w-4" /> Watch live
            </Link>
          )}
          <PublicProfileActions
            authed={!!sessionUserId}
            isMine={sessionUserId === profile.userId}
            profileName={profile.displayName}
            userId={profile.userId}
            tippable={profile.role === "ESCORT"}
            following={following}
            whatsapp={profile.whatsapp}
            country={profile.country}
          />
        </div>
      </section>

      <PublicProfileSections
        bio={profile.bio}
        details={details}
        gallery={gallery}
        interests={profile.interests}
        profileName={profile.displayName}
        profileViews={profile.profileViews}
        reviews={reviews}
        services={profile.services}
        timeline={timeline}
        listingUserId={profile.userId}
        authed={!!sessionUserId}
        isMine={sessionUserId === profile.userId}
      />
    </div>
  );
}
