import { Prisma } from "@prisma/client";
import { db } from "./db";

/** Profile has a photo (avatar or gallery) or a live video/photo post. */
export const HAS_MEDIA: Prisma.ProfileWhereInput = {
  OR: [
    // Generated cartoon avatars (dicebear) are not real media.
    { AND: [{ avatarUrl: { not: "" } }, { NOT: { avatarUrl: { contains: "dicebear" } } }] },
    { photos: { isEmpty: false } },
    {
      user: {
        posts: { some: { hiddenAt: null, OR: [{ imageUrl: { not: "" } }, { videoUrl: { not: "" } }] } },
      },
    },
  ],
};

/** Featured switch (Profiles page). Defaults ON when no settings row exists. */
export async function featuredShowAll() {
  const row = await db.platformSettings.findUnique({ where: { id: "default" }, select: { featuredShowAll: true } });
  return row?.featuredShowAll ?? true;
}

/** Admin switch (Profiles page). Defaults ON when no settings row exists. */
export async function feedShowAnyWithMedia() {
  const row = await db.platformSettings.findUnique({
    where: { id: "default" },
    select: { feedShowAnyWithMedia: true },
  });
  return row?.feedShowAnyWithMedia ?? true;
}
