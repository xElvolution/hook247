import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  BUILD_OPTIONS,
  EDUCATION_OPTIONS,
  BUST_OPTIONS,
  ETHNICITY_OPTIONS,
  ORIENTATION_OPTIONS,
  ALL_OFFERS,
  SMOKING_OPTIONS,
  THIGH_OPTIONS,
  isRatePackage,
  citiesFor,
  statesFor,
} from "@/lib/profileOptions";
import { getSessionUserId } from "@/lib/session";
import { ageFrom, getActiveSessionUserId } from "@/lib/user";
import { normalizeWhatsApp } from "@/lib/whatsapp";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const profile = await db.profile.findUnique({
      where: { userId },
      include: { services: { orderBy: { name: "asc" } } },
    });
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ profile: null, dbDown: true });
  }
}

const schema = z
  .object({
    displayName: z.string().min(2).max(40),
    birthDate: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
    gender: z.enum(["MALE", "FEMALE", "NONBINARY"]),
    lookingFor: z.array(z.enum(["MALE", "FEMALE", "NONBINARY"])).min(1),
    bio: z.string().max(500).default(""),
    country: z.string().min(1).max(80),
    state: z.string().min(1).max(80),
    city: z.string().min(1).max(80),
    ethnicity: z.enum(ETHNICITY_OPTIONS),
    bodyBuild: z.enum(BUILD_OPTIONS),
    bustSize: z.enum(BUST_OPTIONS).or(z.literal("")).default(""),
    thighs: z.enum(THIGH_OPTIONS).or(z.literal("")).default(""),
    education: z.enum(EDUCATION_OPTIONS),
    smoking: z.enum(SMOKING_OPTIONS),
    orientation: z.enum(ORIENTATION_OPTIONS),
    availableToday: z.boolean().default(false),
    interests: z.array(z.string().max(30)).max(10).default([]),
    avatarUrl: z.string().default(""),
    photos: z.array(z.string().max(500)).max(12).default([]),
    clips: z.array(z.string().max(500)).max(6).default([]),
    role: z.enum(["ESCORT", "CLIENT"]).default("ESCORT"),
    phoneCountry: z.string().min(1).max(80).optional(),
    whatsapp: z.string().max(20).default(""),
    services: z
      .array(
        z.object({
          name: z.enum(ALL_OFFERS),
          incallRate: z.number().int().positive().nullable(),
          outcallRate: z.number().int().positive().nullable(),
          enabled: z.boolean(),
        })
      )
      .max(ALL_OFFERS.length)
      .default([]),
  })
  .superRefine((data, ctx) => {
    const knownStates = statesFor(data.country);
    if (knownStates.length > 0 && !knownStates.includes(data.state)) {
      ctx.addIssue({ code: "custom", path: ["state"], message: "Choose a valid state" });
    }
    const knownCities = citiesFor(data.country, data.state);
    if (knownCities.length > 0 && !knownCities.includes(data.city)) {
      ctx.addIssue({ code: "custom", path: ["city"], message: "Choose a valid city" });
    }
    if (data.role === "ESCORT" && !data.bustSize) {
      ctx.addIssue({ code: "custom", path: ["bustSize"], message: "Choose bust size" });
    }
    if (data.role === "ESCORT" && !data.thighs) {
      ctx.addIssue({ code: "custom", path: ["thighs"], message: "Choose thighs" });
    }
    if (data.role === "ESCORT" && !normalizeWhatsApp(data.whatsapp, data.phoneCountry || data.country)) {
      ctx.addIssue({
        code: "custom",
        path: ["whatsapp"],
        message: "Enter a valid WhatsApp number for that country code",
      });
    }
    if (
      data.role === "ESCORT" &&
      !data.services.some((service) => service.enabled && !isRatePackage(service.name))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["services"],
        message: "Pick at least one service for your profile",
      });
    }
    const packages = data.services.filter(
      (service) => isRatePackage(service.name) && (service.incallRate || service.outcallRate)
    );
    if (data.role === "ESCORT" && packages.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["services"],
        message: "Set a Short time, Overnight or Weekend rate",
      });
    }
  });

export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const birth = new Date(data.birthDate);
  if (ageFrom(birth) < 18) {
    return NextResponse.json(
      { error: "You must be 18 or older to join Hook247." },
      { status: 403 }
    );
  }

  const avatarUrl =
    data.avatarUrl ||
    `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(data.displayName)}`;

  const profile = await db.profile.upsert({
    where: { userId },
    create: {
      userId,
      displayName: data.displayName,
      birthDate: birth,
      gender: data.gender,
      lookingFor: data.lookingFor,
      bio: data.bio,
      country: data.country,
      state: data.state,
      city: data.city,
      ethnicity: data.ethnicity,
      bodyBuild: data.bodyBuild,
      bustSize: data.bustSize,
      thighs: data.thighs,
      education: data.education,
      smoking: data.smoking,
      orientation: data.orientation,
      availableToday: data.availableToday,
      interests: data.interests,
      avatarUrl,
      photos: data.photos,
      clips: data.clips,
      role: data.role,
      whatsapp: data.role === "ESCORT" ? normalizeWhatsApp(data.whatsapp, data.phoneCountry || data.country) : "",
      services: {
        create: data.role === "ESCORT" ? data.services.filter((service) => service.enabled) : [],
      },
    },
    update: {
      displayName: data.displayName,
      birthDate: birth,
      gender: data.gender,
      lookingFor: data.lookingFor,
      bio: data.bio,
      country: data.country,
      state: data.state,
      city: data.city,
      ethnicity: data.ethnicity,
      bodyBuild: data.bodyBuild,
      bustSize: data.bustSize,
      thighs: data.thighs,
      education: data.education,
      smoking: data.smoking,
      orientation: data.orientation,
      availableToday: data.availableToday,
      interests: data.interests,
      avatarUrl,
      photos: data.photos,
      clips: data.clips,
      role: data.role,
      whatsapp: data.role === "ESCORT" ? normalizeWhatsApp(data.whatsapp, data.phoneCountry || data.country) : "",
      services: {
        deleteMany: {},
        create: data.role === "ESCORT" ? data.services.filter((service) => service.enabled) : [],
      },
    },
    include: { services: true },
  });

  return NextResponse.json({ ok: true, profile });
}
