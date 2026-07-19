import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEMO_PROFILES, type PublicProfile } from "@/lib/demoProfiles";
import { ageFrom } from "@/lib/user";
import type { Prisma } from "@prisma/client";

const ONLINE_WINDOW_MS = 30 * 60 * 1000;
type ProfileWithServices = Prisma.ProfileGetPayload<{ include: { services: true } }>;

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

  const commonFilters: Prisma.ProfileWhereInput[] = [];
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

  try {
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
    const normalizedQuery = query.toLowerCase();
    const matchesCommonFilters = (profile: PublicProfile) => {
      if (country && profile.country.toLowerCase() !== country.toLowerCase()) return false;
      if (state && profile.state.toLowerCase() !== state.toLowerCase()) return false;
      if (city && profile.city.toLowerCase() !== city.toLowerCase()) return false;
      if (gender && profile.gender !== gender) return false;
      if (ethnicity && profile.ethnicity.toLowerCase() !== ethnicity.toLowerCase()) return false;
      if (bodyBuild && profile.bodyBuild.toLowerCase() !== bodyBuild.toLowerCase()) return false;
      if (interest && !profile.interests.includes(interest)) return false;
      if (service && !profile.services.some((item) => item.enabled && item.name === service)) return false;
      if (minAge >= 18 && profile.age < minAge) return false;
      if (maxAge >= 18 && profile.age > maxAge) return false;
      return true;
    };

    const inArea = DEMO_PROFILES.filter(matchesCommonFilters);
    let members = [...inArea];

    if (tab === "verified") members = members.filter((profile) => profile.verified);
    if (tab === "online") {
      members = members.filter((profile) => profile.online || profile.availableToday);
    }
    if (tab === "new") members.sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime());
    if (normalizedQuery) {
      members = members.filter((profile) =>
        [profile.displayName, profile.city, profile.state, profile.bio].some((value) =>
          value.toLowerCase().includes(normalizedQuery)
        )
      );
    }

    return NextResponse.json({
      featured: inArea.filter((profile) => profile.boosted || profile.verified),
      live: inArea.filter((profile) => profile.live),
      members,
      demoMode: true,
    });
  }
}
