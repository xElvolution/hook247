import type { ServiceRate } from "./profileOptions";

export type PublicProfile = {
  userId: string;
  displayName: string;
  age: number;
  gender: "MALE" | "FEMALE" | "NONBINARY";
  country: string;
  state: string;
  city: string;
  bio: string;
  avatarUrl: string;
  photos: string[];
  interests: string[];
  ethnicity: string;
  bodyBuild: string;
  education: string;
  smoking: string;
  orientation: string;
  services: ServiceRate[];
  verified: boolean;
  boosted: boolean;
  online: boolean;
  availableToday: boolean;
  live: boolean;
  profileViews: number;
  joinedAt: Date;
};
