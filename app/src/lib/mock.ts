import { getSessionUserId } from "./session";

export const MOCK_USER_ID = "mock-demo";

export function mockLoginEnabled() {
  if (process.env.ALLOW_MOCK_LOGIN === "0") return false;
  if (process.env.ALLOW_MOCK_LOGIN === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export function isMockUserId(id: string | null | undefined) {
  return id === MOCK_USER_ID || !!id?.startsWith("mock-");
}

export async function isMockSession() {
  return isMockUserId(await getSessionUserId());
}

function birth(age: number) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  d.setMonth(5, 15);
  d.setHours(12, 0, 0, 0);
  return d;
}

function avatar(style: string, name: string) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(name)}&backgroundColor=1f1229`;
}

type Gender = "MALE" | "FEMALE" | "NONBINARY";
type Plan = "FREE" | "PLUS" | "ELITE";

type Person = {
  id: string;
  name: string;
  email: string;
  gender: Gender;
  lookingFor: Gender[];
  age: number;
  city: string;
  state: string;
  bio: string;
  interests: string[];
  style: string;
  ethnicity: string;
  bodyBuild: string;
  education: string;
  smoking: string;
  orientation: string;
  plan: Plan;
  verified: boolean;
  boosted: boolean;
  live: boolean;
  availableToday: boolean;
  services: Array<{ name: string; outcallRate: number; incallRate?: number }>;
};

const PEOPLE: Person[] = [
  { id: MOCK_USER_ID, name: "Demo", email: "demo@hook247.app", gender: "MALE", lookingFor: ["FEMALE"], age: 27, city: "Ikeja", state: "Lagos", bio: "Just here to test the vibe. Swipe kindly.", interests: ["Tech", "Music", "Foodie"], style: "micah", ethnicity: "Black / African", bodyBuild: "Athletic", education: "BSc", smoking: "No", orientation: "Straight", plan: "ELITE", verified: true, boosted: false, live: false, availableToday: true, services: [] },
  { id: "mock-amara", name: "Amara", email: "amara@hook247.app", gender: "FEMALE", lookingFor: ["MALE"], age: 24, city: "Lekki", state: "Lagos", bio: "Amala on Sundays, amapiano always. Make me laugh and we're halfway there.", interests: ["Afrobeats", "Foodie", "Dancing"], style: "lorelei", ethnicity: "Black / African", bodyBuild: "Curvy", education: "BSc", smoking: "No", orientation: "Straight", plan: "FREE", verified: true, boosted: true, live: true, availableToday: true, services: [{ name: "Dinner Dates", outcallRate: 60000 }] },
  { id: "mock-zainab", name: "Zainab", email: "zainab@hook247.app", gender: "FEMALE", lookingFor: ["MALE"], age: 23, city: "Maitama", state: "Federal Capital Territory", bio: "Med student by day, jollof critic by night.", interests: ["Books", "Movies", "Travel"], style: "lorelei", ethnicity: "Black / African", bodyBuild: "Slim", education: "BSc", smoking: "No", orientation: "Straight", plan: "FREE", verified: true, boosted: false, live: false, availableToday: true, services: [{ name: "Dinner Dates", outcallRate: 55000 }] },
  { id: "mock-bisi", name: "Bisi", email: "bisi@hook247.app", gender: "FEMALE", lookingFor: ["MALE", "FEMALE"], age: 26, city: "Bodija", state: "Oyo", bio: "Gym in the morning, galleries in the evening. Balance.", interests: ["Gym", "Art", "Fashion"], style: "adventurer", ethnicity: "Black / African", bodyBuild: "Athletic", education: "Diploma", smoking: "Occasionally", orientation: "Bisexual", plan: "FREE", verified: false, boosted: false, live: false, availableToday: false, services: [{ name: "Massage", outcallRate: 45000, incallRate: 35000 }] },
  { id: "mock-chiamaka", name: "Chiamaka", email: "chiamaka@hook247.app", gender: "FEMALE", lookingFor: ["MALE"], age: 25, city: "New Haven", state: "Enugu", bio: "Product designer. I will redesign your life (affectionately).", interests: ["Tech", "Art", "Music"], style: "notionists", ethnicity: "Black / African", bodyBuild: "Average", education: "Masters", smoking: "No", orientation: "Straight", plan: "FREE", verified: true, boosted: false, live: false, availableToday: false, services: [] },
  { id: "mock-tolu", name: "Tolu", email: "tolu@hook247.app", gender: "FEMALE", lookingFor: ["MALE"], age: 22, city: "Victoria Island", state: "Lagos", bio: "Island girl with mainland energy. Suya > roses.", interests: ["Nightlife", "Foodie", "Afrobeats"], style: "adventurer", ethnicity: "Black / African", bodyBuild: "Slim", education: "Diploma", smoking: "Occasionally", orientation: "Straight", plan: "FREE", verified: false, boosted: false, live: true, availableToday: true, services: [{ name: "Dinner Dates", outcallRate: 50000 }] },
  { id: "mock-emeka", name: "Emeka", email: "emeka@hook247.app", gender: "MALE", lookingFor: ["FEMALE"], age: 29, city: "Independence Layout", state: "Enugu", bio: "Software engineer. My love language is fixing your wifi.", interests: ["Tech", "Gaming", "Football"], style: "micah", ethnicity: "Black / African", bodyBuild: "Average", education: "BSc", smoking: "No", orientation: "Straight", plan: "FREE", verified: true, boosted: false, live: false, availableToday: false, services: [] },
  { id: "mock-tunde", name: "Tunde", email: "tunde@hook247.app", gender: "MALE", lookingFor: ["FEMALE"], age: 27, city: "Wuse", state: "Federal Capital Territory", bio: "Photographer. I'll make your grid unrecognizable.", interests: ["Art", "Travel", "Movies"], style: "avataaars", ethnicity: "Black / African", bodyBuild: "Slim", education: "BSc", smoking: "Occasionally", orientation: "Straight", plan: "FREE", verified: false, boosted: true, live: false, availableToday: false, services: [] },
  { id: "mock-dami", name: "Dami", email: "dami@hook247.app", gender: "NONBINARY", lookingFor: ["MALE", "FEMALE", "NONBINARY"], age: 24, city: "Yaba", state: "Lagos", bio: "DJ + producer. Come for the playlists, stay for the plantain.", interests: ["Music", "Nightlife", "Afrobeats"], style: "notionists", ethnicity: "Black / African", bodyBuild: "Slim", education: "Secondary", smoking: "Occasionally", orientation: "Queer", plan: "FREE", verified: true, boosted: false, live: true, availableToday: true, services: [{ name: "Event companion", outcallRate: 80000 }] },
  { id: "mock-ngozi", name: "Ngozi", email: "ngozi@hook247.app", gender: "FEMALE", lookingFor: ["MALE"], age: 28, city: "Ajah", state: "Lagos", bio: "Lawyer. I argue for a living — I promise I'm fun at parties.", interests: ["Books", "Fashion", "Travel"], style: "lorelei", ethnicity: "Black / African", bodyBuild: "Curvy", education: "Masters", smoking: "No", orientation: "Straight", plan: "PLUS", verified: false, boosted: false, live: false, availableToday: true, services: [{ name: "Dinner Dates", outcallRate: 70000 }] },
];

function person(p: Person) {
  return {
    ...p,
    birthDate: birth(p.age),
    avatarUrl: avatar(p.style, p.name),
  };
}

const CATALOG = PEOPLE.map(person);

function others() {
  return CATALOG.filter((p) => p.id !== MOCK_USER_ID);
}

function card(p: (typeof CATALOG)[number]) {
  return {
    userId: p.id,
    displayName: p.name,
    age: p.age,
    gender: p.gender,
    country: "Nigeria",
    state: p.state,
    city: p.city,
    bio: p.bio,
    avatarUrl: p.avatarUrl,
    photos: [] as string[],
    interests: p.interests,
    ethnicity: p.ethnicity,
    bodyBuild: p.bodyBuild,
    education: p.education,
    smoking: p.smoking,
    orientation: p.orientation,
    services: p.services.map((s) => ({
      name: s.name,
      incallRate: s.incallRate ?? null,
      outcallRate: s.outcallRate,
      enabled: true,
    })),
    verified: p.verified,
    boosted: p.boosted,
    online: p.availableToday,
    availableToday: p.availableToday,
    live: p.live,
    profileViews: 40 + p.age,
    joinedAt: new Date("2026-03-01"),
  };
}

export function mockCurrentUser() {
  const me = CATALOG.find((p) => p.id === MOCK_USER_ID)!;
  return {
    id: me.id,
    email: me.email,
    passwordHash: "",
    emailVerified: true,
    createdAt: new Date("2026-01-01"),
    bannedAt: null,
    banReason: "",
    suspendedUntil: null,
    profile: {
      id: "mock-profile",
      userId: me.id,
      displayName: me.name,
      birthDate: me.birthDate,
      gender: me.gender,
      lookingFor: me.lookingFor,
      bio: me.bio,
      country: "Nigeria",
      state: me.state,
      city: me.city,
      ethnicity: me.ethnicity,
      bodyBuild: me.bodyBuild,
      education: me.education,
      smoking: me.smoking,
      orientation: me.orientation,
      interests: me.interests,
      avatarUrl: me.avatarUrl,
      photos: [] as string[],
      verified: me.verified,
      verifiedSource: "REVIEWED" as const,
      verifiedAt: new Date("2026-04-01"),
      verifyNote: "",
      availableToday: me.availableToday,
      isLive: me.live,
      profileViews: 128,
      plan: me.plan,
      boostedAt: me.boosted ? new Date() : null,
      lastActive: new Date(),
      createdAt: new Date("2026-01-01"),
      services: me.services.map((s, i) => ({
        id: `mock-svc-${i}`,
        profileId: "mock-profile",
        name: s.name,
        incallRate: s.incallRate ?? null,
        outcallRate: s.outcallRate,
        enabled: true,
      })),
    },
  };
}

export function mockBrowse() {
  const members = others().map(card);
  return {
    featured: members.filter((m) => m.boosted || m.verified).slice(0, 8),
    live: members.filter((m) => m.live),
    members,
  };
}

export function mockDiscover() {
  return {
    guest: false,
    profiles: others()
      .filter((p) => p.gender === "FEMALE" || p.gender === "NONBINARY")
      .map((p) => ({
        userId: p.id,
        displayName: p.name,
        age: p.age,
        bio: p.bio,
        city: p.city,
        state: p.state,
        interests: p.interests,
        avatarUrl: p.avatarUrl,
        photos: [] as string[],
        verified: p.verified,
        boosted: p.boosted,
        live: p.live,
        services: p.services.map((s) => s.name),
      })),
  };
}

export function mockFeed() {
  const posts = [
    { author: "mock-amara", body: "Friday night in Lagos and the playlist is IMMACULATE. Who's out tonight?" },
    { author: "mock-emeka", body: "Hot take: the best first date is a food market walk. Fight me (then feed me)." },
    { author: "mock-dami", body: "Dropped a new mix today. First person to guess the opening track gets a shoutout." },
    { author: "mock-zainab", body: "Exam season done!! I'm officially accepting date ideas that don't involve a library." },
    { author: "mock-ngozi", body: "Unpopular opinion: small chops are a full meal and I will not be taking questions." },
  ];
  const rec = others().slice(0, 6).map((p) => ({
    userId: p.id,
    displayName: p.name,
    age: p.age,
    city: p.city,
    avatarUrl: p.avatarUrl,
    verified: p.verified,
    live: p.live,
  }));
  return {
    guest: false,
    recommended: rec,
    posts: posts.map((post, i) => {
      const author = CATALOG.find((p) => p.id === post.author)!;
      return {
        id: `mock-post-${i + 1}`,
        body: post.body,
        imageUrl: "",
        videoUrl: "",
        posterUrl: "",
        category: i === 0 ? "trending" : "explore",
        views: 220 + i * 17,
        poll: null,
        createdAt: new Date(Date.now() - i * 3600_000),
        mine: false,
        author: {
          userId: author.id,
          displayName: author.name,
          age: author.age,
          avatarUrl: author.avatarUrl,
          verified: author.verified,
        },
        likeCount: 4 + i,
        commentCount: 1,
        likedByMe: store().likes.has(`mock-post-${i + 1}`),
        comments: [
          {
            id: `mock-c-${i}`,
            body: "This is the vibe.",
            author: "Demo",
            avatarUrl: CATALOG[0].avatarUrl,
          },
        ],
      };
    }),
  };
}

export function mockMatches() {
  const seeded = [
    { id: "mock-match-amara", with: "mock-amara", last: "You coming out tonight?", mine: false },
    { id: "mock-match-zainab", with: "mock-zainab", last: "Library is officially closed 📚", mine: false },
  ];
  const extra = store().matches;
  const all = [...seeded, ...extra];
  return {
    matches: all.map((m) => {
      const p = CATALOG.find((x) => x.id === m.with)!;
      return {
        matchId: m.id,
        userId: p.id,
        displayName: p.name,
        age: p.age,
        avatarUrl: p.avatarUrl,
        verified: p.verified,
        city: p.city,
        lastMessage: {
          body: m.last,
          mine: m.mine,
          at: new Date(),
        },
        matchedAt: new Date(),
      };
    }),
  };
}

export function mockLikers() {
  const likers = others().slice(0, 3).map((p) => ({
    userId: p.id,
    displayName: p.name,
    age: p.age,
    avatarUrl: p.avatarUrl,
    city: p.city,
    verified: p.verified,
  }));
  return { locked: false, count: likers.length, likers };
}

export function mockPublicProfile(userId: string) {
  const p = CATALOG.find((x) => x.id === userId);
  if (!p) return null;
  return card(p);
}

export function mockLiveHosts() {
  return others()
    .filter((p) => p.live)
    .map((p) => ({
      userId: p.id,
      displayName: p.name,
      age: p.age,
      city: p.city,
      state: p.state,
      avatarUrl: p.avatarUrl,
      bio: p.bio,
      interests: p.interests,
      services: p.services.map((s) => s.name),
      verified: p.verified,
    }));
}

type Store = {
  likes: Set<string>;
  matches: Array<{ id: string; with: string; last: string; mine: boolean }>;
  threads: Map<string, Array<{ id: string; body: string; mine: boolean; at: Date }>>;
};

function store(): Store {
  const g = globalThis as unknown as { __hook247Mock?: Store };
  if (!g.__hook247Mock) {
    g.__hook247Mock = {
      likes: new Set(),
      matches: [],
      threads: new Map([
        [
          "mock-match-amara",
          [
            { id: "m1", body: "Hey! Liked your profile 🔥", mine: true, at: new Date(Date.now() - 3600_000) },
            { id: "m2", body: "You coming out tonight?", mine: false, at: new Date(Date.now() - 1800_000) },
          ],
        ],
        [
          "mock-match-zainab",
          [
            { id: "z1", body: "Congrats on finishing exams!", mine: true, at: new Date(Date.now() - 7200_000) },
            { id: "z2", body: "Library is officially closed 📚", mine: false, at: new Date(Date.now() - 2400_000) },
          ],
        ],
      ]),
    };
  }
  return g.__hook247Mock;
}

export function mockToggleLike(postId: string) {
  const likes = store().likes;
  if (likes.has(postId)) {
    likes.delete(postId);
    return { liked: false };
  }
  likes.add(postId);
  return { liked: true };
}

export function mockSwipe(targetUserId: string, liked: boolean) {
  if (!liked) return { ok: true, matched: false, matchId: null as string | null };
  const p = CATALOG.find((x) => x.id === targetUserId);
  if (!p) return { ok: true, matched: false, matchId: null };
  const id = `mock-match-${p.name.toLowerCase()}`;
  if (!store().matches.some((m) => m.id === id) && !id.endsWith("amara") && !id.endsWith("zainab")) {
    store().matches.push({ id, with: p.id, last: "It's a match!", mine: true });
  }
  if (!store().threads.has(id)) {
    store().threads.set(id, [
      { id: `n-${id}`, body: "It's a match!", mine: true, at: new Date() },
    ]);
  }
  return { ok: true, matched: true, matchId: id };
}

export function mockThread(matchId: string) {
  const fromMatches = mockMatches().matches.find((m) => m.matchId === matchId);
  if (!fromMatches) return null;
  const messages = store().threads.get(matchId) ?? [];
  return {
    other: {
      userId: fromMatches.userId,
      displayName: fromMatches.displayName,
      avatarUrl: fromMatches.avatarUrl,
      verified: fromMatches.verified,
    },
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      mine: m.mine,
      at: m.at,
    })),
  };
}

export function mockSend(matchId: string, body: string) {
  const thread = store().threads.get(matchId) ?? [];
  const message = { id: `s-${Date.now()}`, body, mine: true, at: new Date() };
  thread.push(message);
  store().threads.set(matchId, thread);
  const extra = store().matches.find((m) => m.id === matchId);
  if (extra) extra.last = body;
  return { ok: true, message };
}