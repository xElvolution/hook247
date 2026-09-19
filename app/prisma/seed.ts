import { PrismaClient, Gender, Plan } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const PASSWORD = "hook247demo";

type SeedUser = {
  email: string;
  name: string;
  gender: Gender;
  lookingFor: Gender[];
  age: number;
  city: string;
  state: string;
  bio: string;
  interests: string[];
  style: string;
  ethnicity?: string;
  bodyBuild?: string;
  education?: string;
  smoking?: string;
  orientation?: string;
  services?: Array<{ name: string; outcallRate: number; incallRate?: number }>;
  plan?: Plan;
  verified?: boolean;
  boosted?: boolean;
  live?: boolean;
  availableToday?: boolean;
};

const USERS: SeedUser[] = [
  { email: "demo@hook247.app", name: "Demo", gender: "MALE", lookingFor: ["FEMALE"], age: 27, city: "Ikeja", state: "Lagos", bio: "Just here to test the vibe. Swipe kindly.", interests: ["Tech", "Music", "Foodie"], style: "micah", plan: "ELITE", verified: true, ethnicity: "Black / African", bodyBuild: "Athletic", education: "BSc", smoking: "No", orientation: "Straight" },
  { email: "amara@hook247.app", name: "Amara", gender: "FEMALE", lookingFor: ["MALE"], age: 24, city: "Lekki", state: "Lagos", bio: "Amala on Sundays, amapiano always. Make me laugh and we're halfway there.", interests: ["Afrobeats", "Foodie", "Dancing"], style: "lorelei", verified: true, boosted: true, live: true, availableToday: true, ethnicity: "Black / African", bodyBuild: "Curvy", education: "BSc", smoking: "No", orientation: "Straight", services: [{ name: "Dinner Dates", outcallRate: 60000 }, { name: "Event companion", outcallRate: 90000 }] },
  { email: "zainab@hook247.app", name: "Zainab", gender: "FEMALE", lookingFor: ["MALE"], age: 23, city: "Maitama", state: "Federal Capital Territory", bio: "Med student by day, jollof critic by night. 🍚", interests: ["Books", "Movies", "Travel"], style: "lorelei", verified: true, availableToday: true, ethnicity: "Black / African", bodyBuild: "Slim", education: "BSc", smoking: "No", orientation: "Straight", services: [{ name: "Dinner Dates", outcallRate: 55000 }] },
  { email: "bisi@hook247.app", name: "Bisi", gender: "FEMALE", lookingFor: ["MALE", "FEMALE"], age: 26, city: "Bodija", state: "Oyo", bio: "Gym in the morning, galleries in the evening. Balance.", interests: ["Gym", "Art", "Fashion"], style: "adventurer", ethnicity: "Black / African", bodyBuild: "Athletic", education: "Diploma", smoking: "Occasionally", orientation: "Bisexual", services: [{ name: "Massage", outcallRate: 45000, incallRate: 35000 }] },
  { email: "chiamaka@hook247.app", name: "Chiamaka", gender: "FEMALE", lookingFor: ["MALE"], age: 25, city: "New Haven", state: "Enugu", bio: "Product designer. I will redesign your life (affectionately).", interests: ["Tech", "Art", "Music"], style: "notionists", verified: true, ethnicity: "Black / African", bodyBuild: "Average", education: "Masters", smoking: "No", orientation: "Straight" },
  { email: "tolu@hook247.app", name: "Tolu", gender: "FEMALE", lookingFor: ["MALE"], age: 22, city: "Victoria Island", state: "Lagos", bio: "Island girl with mainland energy. Suya > roses.", interests: ["Nightlife", "Foodie", "Afrobeats"], style: "adventurer", live: true, availableToday: true, ethnicity: "Black / African", bodyBuild: "Slim", education: "Diploma", smoking: "Occasionally", orientation: "Straight", services: [{ name: "Dinner Dates", outcallRate: 50000 }, { name: "Travel companion", outcallRate: 200000 }] },
  { email: "emeka@hook247.app", name: "Emeka", gender: "MALE", lookingFor: ["FEMALE"], age: 29, city: "Independence Layout", state: "Enugu", bio: "Software engineer. My love language is fixing your wifi.", interests: ["Tech", "Gaming", "Football"], style: "micah", verified: true, ethnicity: "Black / African", bodyBuild: "Average", education: "BSc", smoking: "No", orientation: "Straight" },
  { email: "tunde@hook247.app", name: "Tunde", gender: "MALE", lookingFor: ["FEMALE"], age: 27, city: "Wuse", state: "Federal Capital Territory", bio: "Photographer. I'll make your grid unrecognizable.", interests: ["Art", "Travel", "Movies"], style: "avataaars", boosted: true, ethnicity: "Black / African", bodyBuild: "Slim", education: "BSc", smoking: "Occasionally", orientation: "Straight" },
  { email: "kelechi@hook247.app", name: "Kelechi", gender: "MALE", lookingFor: ["FEMALE", "NONBINARY"], age: 31, city: "Port Harcourt", state: "Rivers", bio: "Chef. Yes, I will cook for you. No, not on the first date.", interests: ["Foodie", "Music", "Faith"], style: "micah", ethnicity: "Black / African", bodyBuild: "Average", education: "Diploma", smoking: "No", orientation: "Straight" },
  { email: "dami@hook247.app", name: "Dami", gender: "NONBINARY", lookingFor: ["MALE", "FEMALE", "NONBINARY"], age: 24, city: "Yaba", state: "Lagos", bio: "DJ + producer. Come for the playlists, stay for the plantain.", interests: ["Music", "Nightlife", "Afrobeats"], style: "notionists", verified: true, live: true, ethnicity: "Black / African", bodyBuild: "Slim", education: "Secondary", smoking: "Occasionally", orientation: "Queer", services: [{ name: "Event companion", outcallRate: 80000 }] },
  { email: "ngozi@hook247.app", name: "Ngozi", gender: "FEMALE", lookingFor: ["MALE"], age: 28, city: "Ajah", state: "Lagos", bio: "Lawyer. I argue for a living — I promise I'm fun at parties.", interests: ["Books", "Fashion", "Travel"], style: "lorelei", plan: "PLUS", availableToday: true, ethnicity: "Black / African", bodyBuild: "Curvy", education: "Masters", smoking: "No", orientation: "Straight", services: [{ name: "Dinner Dates", outcallRate: 70000 }, { name: "Full evening", outcallRate: 150000 }] },
  { email: "ibrahim@hook247.app", name: "Ibrahim", gender: "MALE", lookingFor: ["FEMALE"], age: 30, city: "Nassarawa", state: "Kano", bio: "Architect. I notice ceilings. It's a problem.", interests: ["Art", "Tech", "Faith"], style: "avataaars", ethnicity: "Black / African", bodyBuild: "Average", education: "Masters", smoking: "No", orientation: "Straight" },
];

const POSTS = [
  { email: "amara@hook247.app", body: "Friday night in Lagos and the playlist is IMMACULATE. Who's out tonight? 🎶🔥" },
  { email: "emeka@hook247.app", body: "Hot take: the best first date is a food market walk. Fight me (then feed me)." },
  { email: "dami@hook247.app", body: "Dropped a new mix today. First person to guess the opening track gets a shoutout on the next one. 🎧" },
  { email: "zainab@hook247.app", body: "Exam season done!! I'm officially accepting date ideas that don't involve a library. 📚❌" },
  { email: "tunde@hook247.app", body: "Golden hour in Abuja hits different. Shot three portraits today and every single one is a whole story." },
  { email: "ngozi@hook247.app", body: "Unpopular opinion: small chops are a full meal and I will not be taking questions." },
  { email: "kelechi@hook247.app", body: "Testing a new smoky jollof recipe tonight. The smoke alarm is my sous chef at this point. 🍳" },
];

function birthDateForAge(age: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  d.setMonth(5, 15); // mid-June, safely 18+ regardless of today
  return d;
}

async function main() {
  console.log("Seeding Hook247…");
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const idByEmail = new Map<string, string>();

  for (const u of USERS) {
    const user = await db.user.upsert({
      where: { email: u.email },
      // Seeded accounts are pre-confirmed so the app is usable straight after
      // seeding without going through the mail flow for each one.
      create: { email: u.email, passwordHash, emailVerified: true },
      update: { emailVerified: true },
    });
    idByEmail.set(u.email, user.id);

    const profileData = {
      displayName: u.name,
      birthDate: birthDateForAge(u.age),
      gender: u.gender,
      lookingFor: u.lookingFor,
      bio: u.bio,
      country: "Nigeria",
      state: u.state,
      city: u.city,
      ethnicity: u.ethnicity ?? "",
      bodyBuild: u.bodyBuild ?? "",
      education: u.education ?? "",
      smoking: u.smoking ?? "",
      orientation: u.orientation ?? "",
      interests: u.interests,
      avatarUrl: `https://api.dicebear.com/9.x/${u.style}/svg?seed=${encodeURIComponent(u.name)}&backgroundColor=1f1229`,
      verified: u.verified ?? false,
      availableToday: u.availableToday ?? false,
      isLive: u.live ?? false,
      plan: u.plan ?? "FREE",
      boostedAt: u.boosted ? new Date() : null,
    };

    const profile = await db.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...profileData },
      update: profileData,
    });

    for (const s of u.services ?? []) {
      await db.serviceOffer.upsert({
        where: { profileId_name: { profileId: profile.id, name: s.name } },
        create: {
          profileId: profile.id,
          name: s.name,
          outcallRate: s.outcallRate,
          incallRate: s.incallRate ?? null,
          enabled: true,
        },
        update: {
          outcallRate: s.outcallRate,
          incallRate: s.incallRate ?? null,
          enabled: true,
        },
      });
    }
  }

  const demoId = idByEmail.get("demo@hook247.app")!;

  // Ladies who liked the demo account → shows up in "Who likes you"
  for (const email of ["amara@hook247.app", "zainab@hook247.app", "tolu@hook247.app"]) {
    const swiperId = idByEmail.get(email)!;
    await db.swipe.upsert({
      where: { swiperId_swipedId: { swiperId, swipedId: demoId } },
      create: { swiperId, swipedId: demoId, liked: true },
      update: {},
    });
  }

  // A mutual like → instant match with chat history for the demo account
  const chiamakaId = idByEmail.get("chiamaka@hook247.app")!;
  await db.swipe.upsert({
    where: { swiperId_swipedId: { swiperId: chiamakaId, swipedId: demoId } },
    create: { swiperId: chiamakaId, swipedId: demoId, liked: true },
    update: {},
  });
  await db.swipe.upsert({
    where: { swiperId_swipedId: { swiperId: demoId, swipedId: chiamakaId } },
    create: { swiperId: demoId, swipedId: chiamakaId, liked: true },
    update: {},
  });
  const [a, b] = [demoId, chiamakaId].sort();
  const match = await db.match.upsert({
    where: { userAId_userBId: { userAId: a, userBId: b } },
    create: { userAId: a, userBId: b },
    update: {},
  });
  if ((await db.message.count({ where: { matchId: match.id } })) === 0) {
    await db.message.createMany({
      data: [
        { matchId: match.id, senderId: chiamakaId, body: "Okay your bio actually made me laugh 😂" },
        { matchId: match.id, senderId: demoId, body: "Mission accomplished. So… designer huh? Roast my profile." },
        { matchId: match.id, senderId: chiamakaId, body: "The avatar is giving 'tech bro who owns exactly one plant'. Am I wrong?" },
      ],
    });
  }

  // Feed posts + likes + a few comments
  for (const [index, p] of POSTS.entries()) {
    const authorId = idByEmail.get(p.email)!;
    const exists = await db.post.findFirst({ where: { authorId, body: p.body } });
    if (exists) continue;
    const post = await db.post.create({ data: { authorId, body: p.body } });

    // Deterministic spread of likers so a re-seed reproduces the same counts.
    const likerEmails = USERS.filter((u) => u.email !== p.email)
      .slice(0, 3 + (index % 5))
      .map((u) => u.email);
    for (const e of likerEmails) {
      await db.postLike.upsert({
        where: { postId_userId: { postId: post.id, userId: idByEmail.get(e)! } },
        create: { postId: post.id, userId: idByEmail.get(e)! },
        update: {},
      });
    }
  }

  const amaraPost = await db.post.findFirst({
    where: { author: { email: "amara@hook247.app" } },
  });
  if (amaraPost && (await db.comment.count({ where: { postId: amaraPost.id } })) === 0) {
    await db.comment.createMany({
      data: [
        { postId: amaraPost.id, authorId: idByEmail.get("dami@hook247.app")!, body: "Send the playlist or it didn't happen 👀" },
        { postId: amaraPost.id, authorId: idByEmail.get("tunde@hook247.app")!, body: "Lagos Fridays are undefeated" },
      ],
    });
  }

  console.log("✅ Seeded", USERS.length, "users.");
  console.log("   Demo login: demo@hook247.app / " + PASSWORD);
  console.log("   (Every seeded account uses the same password.)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
