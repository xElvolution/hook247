import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ageFrom } from "@/lib/user";
import { VISIBLE_PROFILE } from "@/lib/moderation";
import type { Prisma } from "@prisma/client";
import { isMockSession, mockBrowse } from "@/lib/mock";

const ONLINE_WINDOW_MS = 30 * 60 * 1000;
type ProfileWithServices = Prisma.ProfileGetPayload<{ include: { services: true } }>;
type PublicProfile = {
  userId: string;
  displayName: string;
  age: number;
  gender: string;
  country: string;
  state: string;
  city: string;
  bio: string;
  avatarUrl: string;
  photos: string[];
  interests: string[];
  ethnicity: string;
  bodyBuild: string;
  education: string;
  smoking: string;
  orientation: string;
  services: Array<{
    name: string;
    incallRate: number | null;
    outcallRate: number | null;
    enabled: boolean;
  }>;
  verified: boolean;
  boosted: boolean;
  online: boolean;
  availableToday: boolean;
  live: boolean;
  profileViews: number;
  joinedAt: Date;
};

function card(profile: ProfileWithServices): PublicProfile {
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    age: ageFrom(profile.birthDate),
    gender: profile.gender,
    country: profile.country,
    state: profile.state,
    city: profile.city,
    bio: profile.bio.length > 90 ? `${profile.bio.slice(0, 90)}...` : profile.bio,
    avatarUrl: profile.avatarUrl,
    photos: profile.photos,
    interests: profile.interests,
    ethnicity: profile.ethnicity,
    bodyBuild: profile.bodyBuild,
    education: profile.education,
    smoking: profile.smoking,
    orientation: profile.orientation,
    services: profile.services.map((service) => ({
      name: service.name,
      incallRate: service.incallRate,
      outcallRate: service.outcallRate,
      enabled: service.enabled,
    })),
    verified: profile.verified,
    boosted: !!profile.boostedAt,
    online: Date.now() - profile.lastActive.getTime() < ONLINE_WINDOW_MS,
    availableToday: profile.availableToday,
    live: profile.isLive,
    profileViews: profile.profileViews,
    joinedAt: profile.createdAt,
  };
}

function birthDateForAge(age: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - age);
  return date;
}

export async function GET(request: Request) {
  if (await isMockSession()) {
    return NextResponse.json(mockBrowse());
  }
  try {
  const params = new URL(request.url).searchParams;
  const tab = params.get("tab") ?? "all";
  const query = params.get("q")?.trim() ?? "";
  const interest = params.get("interest")?.trim() ?? "";
  const country = params.get("country")?.trim() ?? "";
  const state = params.get("state")?.trim() ?? "";
  const city = params.get("city")?.trim() ?? "";
  const gender = params.get("gender")?.trim() ?? "";
  const ethnicity = params.get("ethnicity")?.trim() ?? "";
  const bodyBuild = params.get("bodyBuild")?.trim() ?? "";
  const service = params.get("service")?.trim() ?? "";
  const minAge = Number(params.get("minAge") || 0);
  const maxAge = Number(params.get("maxAge") || 0);

  // Seeded with the moderation filter so every list built from it — featured,
  // live and members alike — excludes banned accounts by construction.
  const commonFilters: Prisma.ProfileWhereInput[] = [VISIBLE_PROFILE];
  if (country) commonFilters.push({ country: { equals: country, mode: "insensitive" } });
  if (state) commonFilters.push({ state: { equals: state, mode: "insensitive" } });
  if (city) commonFilters.push({ city: { equals: city, mode: "insensitive" } });
  if (["MALE", "FEMALE", "NONBINARY"].includes(gender)) {
    commonFilters.push({ gender: gender as "MALE" | "FEMALE" | "NONBINARY" });
  }
  if (ethnicity) commonFilters.push({ ethnicity: { equals: ethnicity, mode: "insensitive" } });
  if (bodyBuild) commonFilters.push({ bodyBuild: { equals: bodyBuild, mode: "insensitive" } });
  if (interest) commonFilters.push({ interests: { has: interest } });
  if (service) {
    commonFilters.push({
      services: { some: { name: { equals: service, mode: "insensitive" }, enabled: true } },
    });
  }
  if (minAge >= 18) commonFilters.push({ birthDate: { lte: birthDateForAge(minAge) } });
  if (maxAge >= 18) commonFilters.push({ birthDate: { gte: birthDateForAge(maxAge + 1) } });

  const memberFilters = [...commonFilters];
  if (tab === "verified") memberFilters.push({ verified: true });
  if (tab === "online") {
    memberFilters.push({
      OR: [
        { availableToday: true },
        { lastActive: { gt: new Date(Date.now() - ONLINE_WINDOW_MS) } },
      ],
    });
  }
  if (query) {
    memberFilters.push({
      OR: [
        { displayName: { contains: query, mode: "insensitive" } },
        { bio: { contains: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } },
        { state: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  const memberWhere: Prisma.ProfileWhereInput = memberFilters.length ? { AND: memberFilters } : {};
  const commonWhere: Prisma.ProfileWhereInput = commonFilters.length ? { AND: commonFilters } : {};
  const services = { where: { enabled: true } } as const;

  const [featured, liveProfiles, members] = await Promise.all([
    db.profile.findMany({
      where: {
        AND: [commonWhere, { OR: [{ boostedAt: { not: null } }, { verified: true }] }],
      },
      include: { services },
      orderBy: [{ boostedAt: { sort: "desc", nulls: "last" } }, { lastActive: "desc" }],
      take: 10,
    }),
    db.profile.findMany({
      where: {
        AND: [commonWhere, { isLive: true }],
      },
      include: { services },
      orderBy: { lastActive: "desc" },
      take: 14,
    }),
    db.profile.findMany({
      where: memberWhere,
      include: { services },
      orderBy:
        tab === "new"
          ? { createdAt: "desc" }
          : [{ boostedAt: { sort: "desc", nulls: "last" } }, { lastActive: "desc" }],
      take: 24,
    }),
  ]);

  return NextResponse.json({
    featured: featured.map(card),
    live: liveProfiles.map(card),
    members: members.map(card),
  });
  } catch {
    return NextResponse.json(mockBrowse());
  }
}
