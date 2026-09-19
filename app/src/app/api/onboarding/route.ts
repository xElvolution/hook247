import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  BUILD_OPTIONS,
  EDUCATION_OPTIONS,
  ETHNICITY_OPTIONS,
  ORIENTATION_OPTIONS,
  SERVICE_OPTIONS,
  SMOKING_OPTIONS,
  citiesFor,
  statesFor,
} from "@/lib/profileOptions";
import { getSessionUserId } from "@/lib/session";
import { ageFrom, getActiveSessionUserId } from "@/lib/user";

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
    country: z.string().min(1).max(60),
    state: z.string().min(1).max(60),
    city: z.string().min(1).max(60),
    ethnicity: z.enum(ETHNICITY_OPTIONS),
    bodyBuild: z.enum(BUILD_OPTIONS),
    education: z.enum(EDUCATION_OPTIONS),
    smoking: z.enum(SMOKING_OPTIONS),
    orientation: z.enum(ORIENTATION_OPTIONS),
    availableToday: z.boolean().default(false),
    interests: z.array(z.string().max(30)).max(10).default([]),
    avatarUrl: z.string().default(""),
    services: z
      .array(
        z.object({
          name: z.enum(SERVICE_OPTIONS),
          incallRate: z.number().int().positive().nullable(),
          outcallRate: z.number().int().positive().nullable(),
          enabled: z.boolean(),
        })
      )
      .max(SERVICE_OPTIONS.length)
      .default([]),
  })
  .superRefine((data, ctx) => {
    if (!statesFor(data.country).includes(data.state)) {
      ctx.addIssue({ code: "custom", path: ["state"], message: "Choose a valid state" });
    }
    if (!citiesFor(data.country, data.state).includes(data.city)) {
      ctx.addIssue({ code: "custom", path: ["city"], message: "Choose a valid city" });
    }
    if (data.services.some((service) => service.enabled && !service.incallRate && !service.outcallRate)) {
      ctx.addIssue({
        code: "custom",
        path: ["services"],
        message: "Each enabled service needs at least one rate",
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
      education: data.education,
      smoking: data.smoking,
      orientation: data.orientation,
      availableToday: data.availableToday,
      interests: data.interests,
      avatarUrl,
      services: {
        create: data.services.filter((service) => service.enabled),
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
      education: data.education,
      smoking: data.smoking,
      orientation: data.orientation,
      availableToday: data.availableToday,
      interests: data.interests,
      avatarUrl,
      services: {
        deleteMany: {},
        create: data.services.filter((service) => service.enabled),
      },
    },
    include: { services: true },
  });

  return NextResponse.json({ ok: true, profile });
}
