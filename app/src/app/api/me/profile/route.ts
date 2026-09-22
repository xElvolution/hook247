import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  BUILD_OPTIONS,
  BUST_OPTIONS,
  EDUCATION_OPTIONS,
  ETHNICITY_OPTIONS,
  ORIENTATION_OPTIONS,
  RATE_PACKAGES,
  SERVICE_OPTIONS,
  SMOKING_OPTIONS,
  THIGH_OPTIONS,
  citiesFor,
  isRatePackage,
  statesFor,
} from "@/lib/profileOptions";
import { getActiveSessionUserId, ageFrom } from "@/lib/user";
import { normalizeWhatsApp } from "@/lib/whatsapp";

const aboutSchema = z.object({
  section: z.literal("about"),
  displayName: z.string().min(2).max(40),
  bio: z.string().max(500).default(""),
  availableToday: z.boolean().optional(),
});

const detailsSchema = z.object({
  section: z.literal("details"),
  birthDate: z.string().refine((s) => !isNaN(Date.parse(s))),
  gender: z.enum(["MALE", "FEMALE", "NONBINARY"]),
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
  phoneCountry: z.string().min(1).max(80).optional(),
  whatsapp: z.string().max(20).default(""),
});

const servicesSchema = z.object({
  section: z.literal("services"),
  names: z.array(z.enum(SERVICE_OPTIONS)).min(1).max(SERVICE_OPTIONS.length),
});

const ratesSchema = z.object({
  section: z.literal("rates"),
  packages: z
    .array(
      z.object({
        name: z.enum(RATE_PACKAGES),
        incallRate: z.number().int().positive().nullable(),
        outcallRate: z.number().int().positive().nullable(),
      })
    )
    .min(1),
});

const schema = z.discriminatedUnion("section", [aboutSchema, detailsSchema, servicesSchema, ratesSchema]);

export async function PATCH(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const profile = await db.profile.findUnique({
    where: { userId },
    include: { services: true },
  });
  if (!profile) return NextResponse.json({ error: "No profile yet" }, { status: 400 });

  const data = parsed.data;

  if (data.section === "about") {
    await db.profile.update({
      where: { userId },
      data: {
        displayName: data.displayName.trim(),
        bio: data.bio,
        availableToday: data.availableToday ?? profile.availableToday,
      },
    });
  }

  if (data.section === "details") {
    const birth = new Date(data.birthDate);
    if (ageFrom(birth) < 18) {
      return NextResponse.json({ error: "You must be 18 or older." }, { status: 403 });
    }
    const knownStates = statesFor(data.country);
    if (knownStates.length > 0 && !knownStates.includes(data.state)) {
      return NextResponse.json({ error: "Choose a valid state" }, { status: 400 });
    }
    const knownCities = citiesFor(data.country, data.state);
    if (knownCities.length > 0 && !knownCities.includes(data.city)) {
      return NextResponse.json({ error: "Choose a valid city" }, { status: 400 });
    }
    const phoneCountry = data.phoneCountry || data.country;
    const whatsapp =
      profile.role === "ESCORT" ? normalizeWhatsApp(data.whatsapp, phoneCountry) : "";
    if (profile.role === "ESCORT" && !whatsapp) {
      return NextResponse.json({ error: "Enter a valid WhatsApp number" }, { status: 400 });
    }
    await db.profile.update({
      where: { userId },
      data: {
        birthDate: birth,
        gender: data.gender,
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
        whatsapp,
      },
    });
  }

  if (data.section === "services") {
    await db.$transaction([
      db.serviceOffer.deleteMany({
        where: { profileId: profile.id, name: { notIn: [...RATE_PACKAGES] } },
      }),
      db.serviceOffer.createMany({
        data: data.names.map((name) => ({
          profileId: profile.id,
          name,
          enabled: true,
        })),
        skipDuplicates: true,
      }),
    ]);
  }

  if (data.section === "rates") {
    const rows = data.packages.filter((pack) => pack.incallRate || pack.outcallRate);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Set at least one rate" }, { status: 400 });
    }
    await db.$transaction([
      db.serviceOffer.deleteMany({
        where: { profileId: profile.id, name: { in: [...RATE_PACKAGES] } },
      }),
      db.serviceOffer.createMany({
        data: rows.map((pack) => ({
          profileId: profile.id,
          name: pack.name,
          incallRate: pack.incallRate,
          outcallRate: pack.outcallRate,
          enabled: true,
        })),
      }),
    ]);
  }

  const next = await db.profile.findUnique({
    where: { userId },
    include: { services: { where: { enabled: true }, orderBy: { name: "asc" } } },
  });
  return NextResponse.json({ ok: true, profile: next });
}
