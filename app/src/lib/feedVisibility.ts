import { Prisma } from "@prisma/client";
import { db } from "./db";

/** Profile has a photo (avatar or gallery) or a live video/photo post. */
export const HAS_MEDIA: Prisma.ProfileWhereInput = {
  OR: [
    { avatarUrl: { not: "" } },
    { photos: { isEmpty: false } },
    {
      user: {
        posts: { some: { hiddenAt: null, OR: [{ imageUrl: { not: "" } }, { videoUrl: { not: "" } }] } },
      },
    },
  ],
};

/** Admin switch (Profiles page). Defaults ON when no settings row exists. */
export async function feedShowAnyWithMedia() {
  const row = await db.platformSettings.findUnique({
    where: { id: "default" },
    select: { feedShowAnyWithMedia: true },
  });
  return row?.feedShowAnyWithMedia ?? true;
}
