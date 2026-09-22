import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveSessionUserId } from "@/lib/user";

const url = z
  .string()
  .max(500)
  .refine((value) => value.startsWith("/uploads/") || value.startsWith("https://"), "Invalid media");

const schema = z.object({
  avatarUrl: url.optional(),
  photos: z.array(url).max(12).optional(),
  clips: z.array(url).max(6).optional(),
});

export async function PATCH(req: Request) {
  const userId = await getActiveSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid media" }, { status: 400 });
  }

  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return NextResponse.json({ error: "No profile yet" }, { status: 400 });

  const updated = await db.profile.update({
    where: { userId },
    data: {
      ...(parsed.data.avatarUrl !== undefined ? { avatarUrl: parsed.data.avatarUrl } : {}),
      ...(parsed.data.photos !== undefined ? { photos: parsed.data.photos } : {}),
      ...(parsed.data.clips !== undefined ? { clips: parsed.data.clips } : {}),
    },
    select: { avatarUrl: true, photos: true, clips: true },
  });

  return NextResponse.json({ ok: true, ...updated });
}
