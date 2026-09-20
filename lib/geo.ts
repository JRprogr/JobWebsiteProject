export const EU_COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL",
  "PT", "RO", "SK", "SI", "ES", "SE",
] as const;

// EEA-only members, the UK, Switzerland and the Balkans (commonspace.eu "Europe plus" scope), plus French Guiana as an EU outermost region.
export const OTHER_EUROPE_COUNTRIES = ["NO", "IS", "LI", "GB", "CH", "AL", "BA", "ME", "MK", "RS", "XK", "AD", "MC", "SM", "GF"] as const;

export const EUROPE_COUNTRIES: readonly string[] = [...EU_COUNTRIES, ...OTHER_EUROPE_COUNTRIES];

export type Scope = "europe" | "eu" | "outside" | "all";

export const SCOPES: { value: Scope; label: string }[] = [
  { value: "europe", label: "EUROPE" },
  { value: "eu", label: "EU ONLY" },
  { value: "outside", label: "OUTSIDE EUROPE" },
  { value: "all", label: "GLOBAL" },
];

export function parseScope(value: string | undefined): Scope {
  return SCOPES.some((s) => s.value === value) ? (value as Scope) : "europe";
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}
