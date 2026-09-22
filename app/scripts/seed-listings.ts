import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const HASH = "$2b$10$gbDrW0ajXdc6PyfUCiUhE.7Tk1zm0H/TdxhiBE/a1eDDju3PVNnk6";

const girls = [
  {
    email: "chichi.lekki@hooks247.demo",
    code: "CHI24701",
    name: "ChiChi",
    birth: "1999-04-12",
    city: "Lekki",
    state: "Lagos",
    bio: "Lekki nights, red dress energy. Dinner dates and GFE. Straight talk, no wahala.",
    avatar: "/uploads/listing-chichi.jpg",
    bust: "Large(D-cup)",
    thighs: "Thick",
    build: "Curvy",
    wa: "2348031110001",
    available: true,
    verified: true,
    boosted: true,
    views: 1280,
    services: ["Dinner Dates", "GFE (Girlfriend experience)", "Blow Job", "Massage"],
    rates: [
      { name: "SHORT TIME", incall: 80000, outcall: 120000 },
      { name: "OVER NIGHT", incall: 180000, outcall: 250000 },
      { name: "WEEKEND", incall: 400000, outcall: 550000 },
    ],
  },
  {
    email: "kemi.vi@hooks247.demo",
    code: "KEM24702",
    name: "Kemi",
    birth: "2000-08-03",
    city: "Victoria Island",
    state: "Lagos",
    bio: "VI rooftop girl. Classy, gold, and on time. Travel companion when the vibe is right.",
    avatar: "/uploads/listing-kemi.jpg",
    bust: "Large(C-cup)",
    thighs: "Average",
    build: "Elegant",
    wa: "2348022220002",
    available: true,
    verified: true,
    boosted: false,
    views: 940,
    services: ["Dinner Dates", "Travel Companion", "GFE (Girlfriend experience)", "Couples"],
    rates: [
      { name: "SHORT TIME", incall: 100000, outcall: 150000 },
      { name: "OVER NIGHT", incall: 220000, outcall: 300000 },
      { name: "WEEKEND", incall: 500000, outcall: 700000 },
    ],
  },
  {
    email: "bisi.ikeja@hooks247.demo",
    code: "BIS24703",
    name: "Bisi",
    birth: "1997-11-21",
    city: "Ikeja",
    state: "Lagos",
    bio: "Ikeja after dark. Curvy, loud laugh, serious head game. Available today.",
    avatar: "/uploads/listing-bisi.jpg",
    bust: "Very Large(DD-cup)",
    thighs: "Heavy",
    build: "Full Fantasy",
    wa: "2348093330003",
    available: true,
    verified: false,
    boosted: false,
    views: 610,
    services: ["Blow Job", "Hand Job", "Erotic massage", "Face Sitting"],
    rates: [
      { name: "SHORT TIME", incall: 60000, outcall: 90000 },
      { name: "OVER NIGHT", incall: 150000, outcall: 200000 },
    ],
  },
  {
    email: "zara.abuja@hooks247.demo",
    code: "ZAR24704",
    name: "Zara",
    birth: "1998-02-14",
    city: "Gwarinpa",
    state: "Abuja",
    bio: "Abuja hotel energy. Quiet, expensive, and clean. Overnight and weekend only.",
    avatar: "/uploads/listing-zara.jpg",
    bust: "Small(A)",
    thighs: "Slim",
    build: "Sleek Frame",
    wa: "2348054440004",
    available: false,
    verified: true,
    boosted: false,
    views: 870,
    services: ["Dinner Dates", "Travel Companion", "GFE (Girlfriend experience)"],
    rates: [
      { name: "OVER NIGHT", incall: 200000, outcall: 280000 },
      { name: "WEEKEND", incall: 450000, outcall: 600000 },
    ],
  },
  {
    email: "titi.yaba@hooks247.demo",
    code: "TIT24705",
    name: "Titi",
    birth: "2001-06-09",
    city: "Yaba",
    state: "Lagos",
    bio: "Yaba street light. Playful, slim, and fast replies. Parties and dinner dates.",
    avatar: "/uploads/listing-titi.jpg",
    bust: "Medium(B-cup)",
    thighs: "Average",
    build: "Slim",
    wa: "2348075550005",
    available: true,
    verified: true,
    boosted: true,
    views: 1540,
    services: ["Dinner Dates", "Beach parties", "Threesome", "Lap dancing"],
    rates: [
      { name: "SHORT TIME", incall: 50000, outcall: 80000 },
      { name: "OVER NIGHT", incall: 130000, outcall: 180000 },
      { name: "WEEKEND", incall: 300000, outcall: 400000 },
    ],
  },
];

async function main() {
  for (const g of girls) {
    const existing = await db.user.findUnique({ where: { email: g.email } });
    if (existing) await db.user.delete({ where: { id: existing.id } });
    const user = await db.user.create({
      data: {
        email: g.email,
        passwordHash: HASH,
        emailVerified: true,
        referralCode: g.code,
        profile: {
          create: {
            displayName: g.name,
            birthDate: new Date(g.birth),
            gender: "FEMALE",
            lookingFor: ["MALE"],
            bio: g.bio,
            country: "Nigeria",
            state: g.state,
            city: g.city,
            ethnicity: "Black",
            bodyBuild: g.build,
            bustSize: g.bust,
            thighs: g.thighs,
            education: "Bsc",
            smoking: "No",
            orientation: "Hetrosexual(Straight)",
            avatarUrl: g.avatar,
            photos: [g.avatar],
            role: "ESCORT",
            whatsapp: g.wa,
            verified: g.verified,
            verifiedSource: g.verified ? "REVIEWED" : "NONE",
            verifiedAt: g.verified ? new Date() : null,
            availableToday: g.available,
            profileViews: g.views,
            plan: "PLUS",
            subscriptionPlanSlug: "monthly",
            subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            boostedAt: g.boosted ? new Date() : null,
            boostedUntil: g.boosted ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
            lastActive: new Date(),
            services: {
              create: [
                ...g.services.map((name) => ({ name, enabled: true })),
                ...g.rates.map((r) => ({
                  name: r.name,
                  incallRate: r.incall,
                  outcallRate: r.outcall,
                  enabled: true,
                })),
              ],
            },
          },
        },
      },
    });
    console.log("created", g.name, user.id);
  }
}

main()
  .then(() => db.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
