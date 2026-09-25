export function naira(kobo: number) {
  const whole = kobo % 100 === 0;
  return `₦${new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(kobo / 100)}`;
}

export function coinCount(coins: number) {
  return new Intl.NumberFormat("en-NG").format(coins);
}

export function newNonce() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
