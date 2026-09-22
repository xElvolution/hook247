type BioInput = {
  name: string;
  city: string;
  offer: string;
  vibe: string;
  services: string[];
  avoid?: string[];
  variation?: number;
};

const TONES = [
  "warm and welcoming",
  "confident and direct",
  "classy and calm",
  "playful without being extra",
  "short and punchy",
  "soft and inviting",
];

function normalizeBio(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function fallbackBio({ name, city, offer, vibe, services, variation = 0, avoid = [] }: BioInput) {
  const where = city ? ` in ${city}` : "";
  const what = offer.trim() || services.slice(0, 3).join(", ") || "good company";
  const who = vibe.trim() || "people who know what they want and treat others well";
  const first = name.trim() || "I";
  const options = [
    `${first}${where}. I offer ${what}. If you're into ${who}, we'll click. Straight talk, no long grammar.`,
    `Hi, I'm ${first}${where}. Book me for ${what}. I keep things easy, private, and worth your time.`,
    `${first} here${where}. ${what}. Come correct, be respectful, and we'll have a good time.`,
    `Looking for ${what}${where}? I'm ${first}. Calm energy, clear rates, no long stories.`,
    `${first}${where}. ${what}, done properly. If that sounds like you, send a message.`,
    `I'm ${first}. Based${where || " around town"}. ${what}. I like ${who}.`,
  ];
  const blocked = new Set(avoid.map(normalizeBio));
  const start = Math.abs(variation) % options.length;
  for (let i = 0; i < options.length; i++) {
    const candidate = options[(start + i) % options.length];
    if (!blocked.has(normalizeBio(candidate))) return candidate;
  }
  return options[start];
}

async function complete(prompt: string, variation: number) {
  const xai = process.env.XAI_API_KEY;
  const temperature = 0.95 + ((variation % 5) * 0.03);
  const system =
    "Write a short escort profile bio. 2-3 sentences, simple English, warm and direct. No slang that sounds fake. No hashtags. No quotes around the whole bio. Never use em dashes or en dashes. Use commas, periods, or colons. Make this version distinct from any previous bio in the prompt.";

  if (xai) {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${xai}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return json.choices?.[0]?.message?.content?.trim() ?? "";
    }
  }

  const openrouter = process.env.OPENROUTER_API_KEY;
  if (openrouter) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openrouter}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://hooks247.com",
        "X-Title": "Hooks247",
      },
      body: JSON.stringify({
        model: "x-ai/grok-4.3",
        temperature,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return json.choices?.[0]?.message?.content?.trim() ?? "";
    }
  }

  return "";
}

function cleanBio(generated: string) {
  return generated
    .replace(/^["']|["']$/g, "")
    .replace(/\s*[—–]+\s*/g, ". ")
    .replace(/\s+\./g, ".")
    .replace(/\.\s*\./g, ".")
    .slice(0, 500)
    .trim();
}

export async function generateProfileBio(input: BioInput) {
  const variation = input.variation ?? Date.now();
  const avoid = (input.avoid ?? []).filter(Boolean).slice(-6);
  const tone = TONES[Math.abs(variation) % TONES.length];
  const prompt = [
    `Name: ${input.name || "unspecified"}`,
    `Area: ${input.city || "Nigeria"}`,
    `What they offer: ${input.offer || input.services.join(", ") || "company"}`,
    `Vibe / who they want: ${input.vibe || "respectful adults"}`,
    `Tone this time: ${tone}`,
    `Variation token: ${variation}`,
    "Write the bio in first person.",
    "Do not repeat or closely paraphrase any previous bio.",
    avoid.length ? `Previous bios to avoid:\n${avoid.map((item) => `- ${item}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const generated = cleanBio(await complete(prompt, variation));
  const blocked = new Set(avoid.map(normalizeBio));
  if (generated && !blocked.has(normalizeBio(generated))) return generated;

  const retry = cleanBio(await complete(`${prompt}\nWrite a completely different bio from the previous attempt.`, variation + 17));
  if (retry && !blocked.has(normalizeBio(retry))) return retry;

  return fallbackBio({ ...input, variation, avoid });
}
