export type LiveComment = {
  t: "comment";
  id: string;
  userId: string;
  name: string;
  avatarUrl: string;
  body: string;
  at: string;
};

export type LiveGiftEvent = {
  t: "gift";
  id: string;
  userId: string;
  name: string;
  giftId: string;
  giftName: string;
  emoji: string;
  coins: number;
  animation?: string;
  at: string;
};

export type LiveEvent = LiveComment | LiveGiftEvent | { t: "ended"; at: string };

export type Gift = { id: string; name: string; emoji: string; coins: number; animation?: string };

/** Private to the host: their share of a gift, sent over the realtime socket. */
export type LiveEarning = {
  sessionId: string;
  id: string;
  shareKobo: number;
  coins: number;
  giftName: string;
  emoji: string;
  from: string;
  at: string;
};

export type LiveState = {
  id: string;
  status: "LIVE" | "ENDED";
  title: string;
  startedAt: string;
  isHost: boolean;
  comments: LiveComment[];
  gifts: Gift[];
  balance: number;
};

export type LiveSummary = {
  id: string;
  title: string;
  durationSeconds: number;
  peakViewers: number;
  coinsEarned: number;
  earnedKobo: number;
  gifts: number;
  comments: number;
  topSupporters: { userId: string; displayName: string; avatarUrl: string; coins: number }[];
};

export function parseLiveEvent(payload: Uint8Array): LiveEvent | null {
  try {
    const data = JSON.parse(new TextDecoder().decode(payload));
    if (data && (data.t === "comment" || data.t === "gift" || data.t === "ended")) return data as LiveEvent;
  } catch {
    // ignore malformed packets
  }
  return null;
}

export function formatElapsed(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export const compact = new Intl.NumberFormat("en", { notation: "compact" });

export function newNonce() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
