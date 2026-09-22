import { COUNTRIES, countryInfo } from "@/lib/profileOptions";

function digitsOnly(input: string) {
  return input.replace(/\D/g, "");
}

function phoneMeta(country: string) {
  const info = countryInfo(country);
  return {
    phonecode: info?.phonecode ?? "234",
    phoneLength: info?.phoneLength || 10,
  };
}

/** Local national number, optional leading 0. */
export function clampLocal(input: string, country: string): string {
  const { phonecode, phoneLength } = phoneMeta(country);
  let digits = digitsOnly(input);
  if (digits.startsWith(phonecode) && digits.length > phonecode.length) {
    digits = digits.slice(phonecode.length);
  }
  if (digits.startsWith("0")) return digits.slice(0, phoneLength + 1);
  return digits.slice(0, phoneLength);
}

export function isValidLocal(input: string, country: string): boolean {
  const { phoneLength } = phoneMeta(country);
  const digits = clampLocal(input, country);
  if (digits.length === phoneLength + 1) return digits.startsWith("0");
  if (digits.length === phoneLength) return !digits.startsWith("0") || phoneLength === 1;
  return false;
}

/** Stored as country code + local digits without a leading 0, for wa.me. */
export function normalizeWhatsApp(input: string, country = "Nigeria"): string {
  const { phonecode, phoneLength } = phoneMeta(country);
  const local = clampLocal(input, country);
  if (local.length === phoneLength + 1 && local.startsWith("0")) {
    return `${phonecode}${local.slice(1)}`;
  }
  if (local.length === phoneLength && (!local.startsWith("0") || phoneLength === 1)) {
    return `${phonecode}${local}`;
  }
  return "";
}

export function toLocalWhatsAppInput(stored: string, country = "Nigeria"): string {
  const { phonecode } = phoneMeta(country);
  const n = digitsOnly(stored);
  if (n.startsWith(phonecode) && n.length > phonecode.length) {
    return n.slice(phonecode.length);
  }
  return clampLocal(stored, country);
}

export function whatsappHref(digits: string, displayName?: string, country = "Nigeria") {
  const n = normalizeWhatsApp(digits, country) || digitsOnly(digits);
  if (!n) return "";
  const text = encodeURIComponent(
    displayName
      ? `Hi ${displayName}, I saw your profile on Hooks247.`
      : "Hi, I saw your profile on Hooks247."
  );
  return `https://wa.me/${n}?text=${text}`;
}

export function formatWhatsApp(digits: string, country = "Nigeria") {
  const stored = digitsOnly(digits);
  if (!stored) return "";
  const { phonecode } = phoneMeta(country);
  if (stored.startsWith(phonecode) && stored.length > phonecode.length) {
    return `+${phonecode} ${stored.slice(phonecode.length)}`;
  }
  if (stored.startsWith("234") && stored.length === 13) return `+234 ${stored.slice(3)}`;
  return stored.startsWith("+") ? stored : `+${stored}`;
}

export function countryDialLabel(country: string) {
  const { phonecode } = phoneMeta(country);
  return `+${phonecode}`;
}

/** Best-matching catalog country for a stored international WhatsApp number. */
export function countryFromStoredWhatsApp(stored: string, fallback = "Nigeria"): string {
  const n = digitsOnly(stored);
  if (!n) return fallback;
  let best = fallback;
  let bestLen = 0;
  for (const name of COUNTRIES) {
    const code = countryInfo(name)?.phonecode ?? "";
    if (code && n.startsWith(code) && code.length >= bestLen) {
      best = name;
      bestLen = code.length;
    }
  }
  return best;
}

/** Back-compat aliases used by older onboarding fields. */
export const clampNigerianLocal = (input: string) => clampLocal(input, "Nigeria");
export const isValidNigerianLocal = (input: string) => isValidLocal(input, "Nigeria");
