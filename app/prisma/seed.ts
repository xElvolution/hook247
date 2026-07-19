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
  bio: string;
  interests: string[];
  style: string;
  plan?: Plan;
  verified?: boolean;
  boosted?: boolean;
};

const USERS: SeedUser[] = [
  { email: "demo@hook247.app", name: "Demo", gender: "MALE", lookingFor: ["FEMALE"], age: 27, city: "Lagos", bio: "Just here to test the vibe. Swipe kindly.", interests: ["Tech", "Music", "Foodie"], style: "micah", plan: "ELITE", verified: true },
  { email: "amara@hook247.app", name: "Amara", gender: "FEMALE", lookingFor: ["MALE"], age: 24, city: "Lagos", bio: "Amala on Sundays, amapiano always. Make me laugh and we're halfway there.", interests: ["Afrobeats", "Foodie", "Dancing"], style: "lorelei", verified: true, boosted: true },
  { email: "zainab@hook247.app", name: "Zainab", gender: "FEMALE", lookingFor: ["MALE"], age: 23, city: "Abuja", bio: "Med student by day, jollof critic by night. 🍚", interests: ["Books", "Movies", "Travel"], style: "lorelei", verified: true },
  { email: "bisi@hook247.app", name: "Bisi", gender: "FEMALE", lookingFor: ["MALE", "FEMALE"], age: 26, city: "Ibadan", bio: "Gym in the morning, galleries in the evening. Balance.", interests: ["Gym", "Art", "Fashion"], style: "adventurer" },
  { email: "chiamaka@hook247.app", name: "Chiamaka", gender: "FEMALE", lookingFor: ["MALE"], age: 25, city: "Enugu", bio: "Product designer. I will redesign your life (affectionately).", interests: ["Tech", "Art", "Music"], style: "notionists", verified: true },
  { email: "tolu@hook247.app", name: "Tolu", gender: "FEMALE", lookingFor: ["MALE"], age: 22, city: "Lagos", bio: "Island girl with mainland energy. Suya > roses.", interests: ["Nightlife", "Foodie", "Afrobeats"], style: "adventurer" },
  { email: "emeka@hook247.app", name: "Emeka", gender: "MALE", lookingFor: ["FEMALE"], age: 29, city: "Enugu", bio: "Software engineer. My love language is fixing your wifi.", interests: ["Tech", "Gaming", "Football"], style: "micah", verified: true },
  { email: "tunde@hook247.app", name: "Tunde", gender: "MALE", lookingFor: ["FEMALE"], age: 27, city: "Abuja", bio: "Photographer. I'll make your grid unrecognizable.", interests: ["Art", "Travel", "Movies"], style: "avataaars", boosted: true },
  { email: "kelechi@hook247.app", name: "Kelechi", gender: "MALE", lookingFor: ["FEMALE", "NONBINARY"], age: 31, city: "Port Harcourt", bio: "Chef. Yes, I will cook for you. No, not on the first date.", interests: ["Foodie", "Music", "Faith"], style: "micah" },
  { email: "dami@hook247.app", name: "Dami", gender: "NONBINARY", lookingFor: ["MALE", "FEMALE", "NONBINARY"], age: 24, city: "Lagos", bio: "DJ + producer. Come for the playlists, stay for the plantain.", interests: ["Music", "Nightlife", "Afrobeats"], style: "notionists", verified: true },
  { email: "ngozi@hook247.app", name: "Ngozi", gender: "FEMALE", lookingFor: ["MALE"], age: 28, city: "Lagos", bio: "Lawyer. I argue for a living — I promise I'm fun at parties.", interests: ["Books", "Fashion", "Travel"], style: "lorelei", plan: "PLUS" },
  { email: "ibrahim@hook247.app", name: "Ibrahim", gender: "MALE", lookingFor: ["FEMALE"], age: 30, city: "Kano", bio: "Architect. I notice ceilings. It's a problem.", interests: ["Art", "Tech", "Faith"], style: "avataaars" },
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
      create: { email: u.email, passwordHash },
      update: {},
    });
    idByEmail.set(u.email, user.id);

    await db.profile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        displayName: u.name,
        birthDate: birthDateForAge(u.age),
        gender: u.gender,
        lookingFor: u.lookingFor,
        bio: u.bio,
        city: u.city,
        interests: u.interests,
        avatarUrl: `https://api.dicebear.com/9.x/${u.style}/svg?seed=${encodeURIComponent(u.name)}&backgroundColor=1f1229`,
        verified: u.verified ?? false,
        plan: u.plan ?? "FREE",
        boostedAt: u.boosted ? new Date() : null,
      },
      update: {},
    });
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
  for (const p of POSTS) {
    const authorId = idByEmail.get(p.email)!;
    const exists = await db.post.findFirst({ where: { authorId, body: p.body } });
    if (exists) continue;
    const post = await db.post.create({ data: { authorId, body: p.body } });

    const likerEmails = USERS.filter((u) => u.email !== p.email)
      .slice(0, 3 + Math.floor(Math.random() * 5))
      .map((u) => u.email);
    for (const e of likerEmails) {
      await db.postLike.create({
        data: { postId: post.id, userId: idByEmail.get(e)! },
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
