export const LOCATION_DATA: Record<string, Record<string, string[]>> = {
  Nigeria: {
    "Federal Capital Territory": ["Asokoro", "Garki", "Gwarinpa", "Jahi", "Maitama", "Wuse"],
    Enugu: ["Enugu", "Independence Layout", "New Haven", "Nsukka"],
    Kano: ["Bompai", "Kano", "Nassarawa", "Tarauni"],
    Lagos: ["Ajah", "Ikeja", "Lekki", "Surulere", "Victoria Island", "Yaba"],
    Oyo: ["Bodija", "Ibadan", "Jericho", "Oluyole"],
    Rivers: ["GRA", "Old GRA", "Port Harcourt", "Trans Amadi"],
  },
  Ghana: {
    "Greater Accra": ["Accra", "East Legon", "Osu", "Tema"],
    Ashanti: ["Ahodwo", "Kumasi", "Nhyiaeso"],
    Central: ["Cape Coast", "Kasoa"],
  },
};

export const COUNTRIES = Object.keys(LOCATION_DATA);

export function statesFor(country: string) {
  return Object.keys(LOCATION_DATA[country] ?? {});
}

export function citiesFor(country: string, state: string) {
  return LOCATION_DATA[country]?.[state] ?? [];
}

export const GENDER_OPTIONS = [
  { value: "", label: "Everyone" },
  { value: "FEMALE", label: "Women" },
  { value: "MALE", label: "Men" },
  { value: "NONBINARY", label: "Non-binary" },
] as const;

export const ETHNICITY_OPTIONS = [
  "Black / African",
  "Asian",
  "White",
  "Mixed",
  "Middle Eastern",
  "Latino / Hispanic",
  "Other",
] as const;

export const BUILD_OPTIONS = ["Slim", "Athletic", "Average", "Curvy", "Plus-size"] as const;
export const EDUCATION_OPTIONS = ["Secondary", "Diploma", "BSc", "Masters", "Doctorate"] as const;
export const SMOKING_OPTIONS = ["No", "Occasionally", "Yes"] as const;
export const ORIENTATION_OPTIONS = ["Straight", "Bisexual", "Gay", "Lesbian", "Queer"] as const;

export const SERVICE_OPTIONS = [
  "Erotic massage",
  "Massage",
  "Couples",
  "Dinner Dates",
  "Hand Job",
  "Prostate Massage",
  "Role Play & Fantasy",
  "Erotic Spanking (giving)",
  "Tantric Massage",
  "GFE (Girlfriend experience)",
  "Event companion",
  "Full evening",
  "Travel companion",
  "Weekend companion",
] as const;

export type ServiceRate = {
  name: string;
  incallRate: number | null;
  outcallRate: number | null;
  enabled: boolean;
};

export function formatNaira(value: number | null) {
  if (value === null) return "--";
  return `N${new Intl.NumberFormat("en-NG").format(value)}`;
}
