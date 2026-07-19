import { NextResponse } from "next/server";
import { getCurrentUser, ageFrom } from "@/lib/user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const p = user.profile;
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      profile: p
        ? {
            displayName: p.displayName,
            age: ageFrom(p.birthDate),
            gender: p.gender,
            lookingFor: p.lookingFor,
            bio: p.bio,
            city: p.city,
            interests: p.interests,
            avatarUrl: p.avatarUrl,
            verified: p.verified,
            plan: p.plan,
            boostedAt: p.boostedAt,
          }
        : null,
    },
  });
}
