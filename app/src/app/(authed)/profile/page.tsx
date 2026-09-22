import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import MyProfileView, { type MyProfileData } from "@/components/MyProfileView";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signup");
  if (!user.profile) redirect("/onboarding");
  const p = user.profile;

  const initial: MyProfileData = {
    userId: user.id,
    email: user.email,
    displayName: p.displayName,
    bio: p.bio,
    availableToday: p.availableToday,
    birthDate: p.birthDate.toISOString().slice(0, 10),
    gender: p.gender,
    country: p.country,
    state: p.state,
    city: p.city,
    ethnicity: p.ethnicity,
    bodyBuild: p.bodyBuild,
    bustSize: p.bustSize,
    thighs: p.thighs,
    education: p.education,
    smoking: p.smoking,
    orientation: p.orientation,
    whatsapp: p.whatsapp,
    role: p.role,
    avatarUrl: p.avatarUrl,
    photos: p.photos,
    clips: p.clips,
    verified: p.verified,
    plan: p.plan,
    boostedUntil: p.boostedUntil ? p.boostedUntil.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    profileViews: p.profileViews,
    services: p.services.map((service) => ({
      name: service.name,
      incallRate: service.incallRate,
      outcallRate: service.outcallRate,
      enabled: service.enabled,
    })),
  };

  return <MyProfileView initial={initial} />;
}
