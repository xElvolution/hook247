import locationCatalog from "./locations.json";

export type LocationCountry = {
  iso: string;
  phonecode: string;
  phoneLength: number;
  states: Record<string, string[]>;
};

export const LOCATION_CATALOG = locationCatalog as Record<string, LocationCountry>;

export const COUNTRIES = [
  "Nigeria",
  ...Object.keys(LOCATION_CATALOG)
    .filter((name) => name !== "Nigeria")
    .sort((a, b) => a.localeCompare(b)),
].filter((name) => name in LOCATION_CATALOG);

export function countryInfo(country: string) {
  return LOCATION_CATALOG[country] ?? null;
}

export function statesFor(country: string) {
  return Object.keys(LOCATION_CATALOG[country]?.states ?? {}).sort((a, b) => a.localeCompare(b));
}

export function citiesFor(country: string, state: string) {
  return [...(LOCATION_CATALOG[country]?.states?.[state] ?? [])].sort((a, b) => a.localeCompare(b));
}

export const GENDER_OPTIONS = [
  { value: "", label: "Everyone" },
  { value: "FEMALE", label: "Women" },
  { value: "MALE", label: "Men" },
  { value: "NONBINARY", label: "Non-binary" },
] as const;

export const ETHNICITY_OPTIONS = [
  "Black",
  "Black / African",
  "Asian",
  "White",
  "Mixed",
  "Middle Eastern",
  "Latino / Hispanic",
  "Other",
] as const;

export const BUILD_OPTIONS = [
  "Sleek Frame",
  "Slim",
  "Athletic",
  "Just Right",
  "Average",
  "Curvy",
  "Full Fantasy",
  "Elegant",
  "Fluffy",
  "Plus-size",
] as const;

export const BUST_OPTIONS = [
  "None",
  "Small(A)",
  "Medium(B-cup)",
  "Large(C-cup)",
  "Large(D-cup)",
  "Very Large(DD-cup)",
] as const;

export const THIGH_OPTIONS = ["Slim", "Average", "Thick", "Heavy"] as const;

export const EDUCATION_OPTIONS = [
  "Student",
  "Secondary",
  "Diploma",
  "Bsc",
  "BSc",
  "Masters",
  "Business",
  "Self employed",
  "Doctorate",
] as const;
export const SMOKING_OPTIONS = ["No", "Occasionally", "Yes"] as const;
export const ORIENTATION_OPTIONS = [
  "Hetrosexual(Straight)",
  "Straight",
  "Bisexual",
  "Gay",
  "Lesbian",
  "Transsexual",
  "Queer",
] as const;

/** Time packages with incall/outcall prices. */
export const RATE_PACKAGES = ["SHORT TIME", "OVER NIGHT", "WEEKEND"] as const;

/** Service checklist for profiles. */
export const SERVICE_OPTIONS = [
  "69 (69 sex position)",
  "A-Level (Anal sex)",
  "Anal Rimming (Licking anus)",
  "Attending corporate parties",
  "BDSM (giving)",
  "BDSM (receiving)",
  "Beach parties",
  "Being Filmed",
  "Blow Job",
  "Body Worship",
  "CIM (Cum in mouth)",
  "COB (Cum on body)",
  "COF (Cum on face)",
  "Couples",
  "DFK (Deep french kissing)",
  "Dinner Dates",
  "Domestic carer",
  "Domination (giving)",
  "Domination (receiving)",
  "Double Penetration",
  "Erotic massage",
  "Erotic Spanking (giving)",
  "Erotic Spanking (receiving)",
  "Face Sitting",
  "Female Stripper",
  "Fetish",
  "Fisting (giving)",
  "Food Play",
  "Foot Fetish",
  "French Kissing",
  "Gang Bang",
  "GFE (Girlfriend experience)",
  "Golden shower",
  "Hand Job",
  "Lap dancing",
  "Male Stripper",
  "Massage",
  "MMF 3somes",
  "Modelling",
  "Normal sex",
  "O-Level (Oral sex)",
  "OWO (Oral without condom)",
  "Oral with condom",
  "PSE (Porn Star Experience)",
  "Parties (Mandatory sex parties)",
  "Pegging",
  "Preparing a meal",
  "Prostrate Massage",
  "Receiving Oral",
  "Rimming (giving)",
  "Rimming (receiving)",
  "Role Play & Fantasy",
  "SURROGATE",
  "Scat (giving)",
  "Sex toys",
  "Smoking (Fetish)",
  "Sub games",
  "Swallow",
  "Swallow (at discretion)",
  "Swinging",
  "Tantric Massage",
  "Threesome",
  "Tie & Tease",
  "Travel Companion",
  "Watersports (giving)",
  "Watersports (receiving)",
] as const;

export const ALL_OFFERS = [...RATE_PACKAGES, ...SERVICE_OPTIONS] as const;

export function isRatePackage(name: string): name is (typeof RATE_PACKAGES)[number] {
  return (RATE_PACKAGES as readonly string[]).includes(name);
}

export type ServiceRate = {
  name: string;
  incallRate: number | null;
  outcallRate: number | null;
  enabled: boolean;
};

export function formatNaira(value: number | null) {
  if (value === null) return "--";
  return `₦${new Intl.NumberFormat("en-NG").format(value)}`;
}

export function formatKobo(kobo: number) {
  return formatNaira(Math.round(kobo / 100));
}
