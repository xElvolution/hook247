import { NextResponse } from "next/server";
import { z } from "zod";
import { generateProfileBio } from "@/lib/ai";
import { getActiveSessionUserId } from "@/lib/user";

const schema = z.object({
  name: z.string().max(40).default(""),
  city: z.string().max(60).default(""),
  offer: z.string().max(280).default(""),
  vibe: z.string().max(280).default(""),
  services: z.array(z.string().max(60)).max(14).default([]),
  avoid: z.array(z.string().max(500)).max(8).default([]),
  variation: z.number().int().optional(),
});

export async function POST(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Tell us a bit more so we can write the bio." }, { status: 400 });
  }

  try {
    const bio = await generateProfileBio(parsed.data);
    return NextResponse.json({ ok: true, bio });
  } catch (err) {
    console.error("bio generate failed", err);
    return NextResponse.json({ error: "Could not generate a bio. Try again." }, { status: 502 });
  }
}
