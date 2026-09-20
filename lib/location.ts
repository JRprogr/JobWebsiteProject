export type ParsedLocation = {
  countries: string[];
  country: string | null;
  city: string | null;
  region: string | null;
  remote: boolean;
};

const COUNTRIES: Record<string, string> = {
  albania: "AL", andorra: "AD", austria: "AT", belarus: "BY", belgium: "BE", "bosnia and herzegovina": "BA", bosnia: "BA",
  bulgaria: "BG", croatia: "HR", cyprus: "CY", "czech republic": "CZ", czechia: "CZ", denmark: "DK", estonia: "EE",
  finland: "FI", france: "FR", germany: "DE", deutschland: "DE", greece: "GR", hungary: "HU", iceland: "IS", ireland: "IE",
  italy: "IT", italia: "IT", kosovo: "XK", latvia: "LV", liechtenstein: "LI", lithuania: "LT", luxembourg: "LU", malta: "MT",
  moldova: "MD", monaco: "MC", montenegro: "ME", netherlands: "NL", "the netherlands": "NL", "north macedonia": "MK",
  macedonia: "MK", norway: "NO", poland: "PL", portugal: "PT", romania: "RO", serbia: "RS", slovakia: "SK", slovenia: "SI",
  spain: "ES", sweden: "SE", switzerland: "CH", turkey: "TR", "türkiye": "TR", ukraine: "UA", "united kingdom": "GB",
  uk: "GB", "great britain": "GB", england: "GB", scotland: "GB", wales: "GB", "northern ireland": "GB",
  "united states": "US", "united states of america": "US", usa: "US", us: "US", "u.s.": "US", canada: "CA", mexico: "MX",
  brazil: "BR", argentina: "AR", chile: "CL", colombia: "CO", india: "IN", japan: "JP", "south korea": "KR", korea: "KR",
  china: "CN", taiwan: "TW", singapore: "SG", australia: "AU", "new zealand": "NZ", israel: "IL",
  "united arab emirates": "AE", uae: "AE", "saudi arabia": "SA", qatar: "QA", "south africa": "ZA", egypt: "EG",
  "french guiana": "GF", philippines: "PH", vietnam: "VN", thailand: "TH", indonesia: "ID", malaysia: "MY", pakistan: "PK",
};

const ISO_CODES = new Set(Object.values(COUNTRIES));

const US_STATES = new Set(
  "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "),
);
const US_STATE_NAMES = new Set(
  ["alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware", "florida", "georgia",
    "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts",
    "michigan", "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada", "new hampshire", "new jersey",
    "new mexico", "new york", "north carolina", "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island",
    "south carolina", "south dakota", "tennessee", "texas", "utah", "vermont", "virginia", "washington", "west virginia",
    "wisconsin", "wyoming", "district of columbia"],
);
const CA_PROVINCES = new Set(["ON", "QC", "BC", "AB", "MB", "NB", "NS", "NL", "PE", "SK", "NT", "NU", "YT"]);
const CA_PROVINCE_NAMES = new Set(
  ["ontario", "quebec", "british columbia", "alberta", "manitoba", "new brunswick", "nova scotia", "newfoundland and labrador",
    "prince edward island", "saskatchewan"],
);

// Where a two-letter token is both a US state and a country, prefer the country unless the city is a known US city.
const AMBIGUOUS_CODES = new Set(["DE", "IL", "IN", "MT", "MD", "ME", "AL", "MA", "AR", "CO", "ID"]);

const CITIES: Record<string, string> = {
  berlin: "DE", munich: "DE", "münchen": "DE", hamburg: "DE", frankfurt: "DE", cologne: "DE", "köln": "DE", stuttgart: "DE",
  bremen: "DE", dresden: "DE", ottobrunn: "DE", "oberpfaffenhofen": "DE", "weßling": "DE", "göttingen": "DE", bonn: "DE",
  paris: "FR", toulouse: "FR", lyon: "FR", bordeaux: "FR", marseille: "FR", "kourou": "GF", london: "GB", bristol: "GB",
  cambridge: "GB", manchester: "GB", edinburgh: "GB", glasgow: "GB", oxford: "GB", farnborough: "GB", rome: "IT", roma: "IT",
  milan: "IT", milano: "IT", turin: "IT", torino: "IT", madrid: "ES", barcelona: "ES", valencia: "ES", lisbon: "PT",
  amsterdam: "NL", noordwijk: "NL", rotterdam: "NL", "the hague": "NL", delft: "NL", brussels: "BE", vienna: "AT",
  wien: "AT", zurich: "CH", "zürich": "CH", geneva: "CH", stockholm: "SE", "linköping": "SE", gothenburg: "SE", kiruna: "SE",
  oslo: "NO", kongsberg: "NO", andenes: "NO", copenhagen: "DK", helsinki: "FI", espoo: "FI", warsaw: "PL", krakow: "PL",
  "kraków": "PL", prague: "CZ", budapest: "HU", bucharest: "RO", athens: "GR", dublin: "IE", luxembourg: "LU",
  tallinn: "EE", riga: "LV", vilnius: "LT", kyiv: "UA", kiev: "UA", sofia: "BG", zagreb: "HR", ljubljana: "SI",
  bratislava: "SK", belgrade: "RS", tirana: "AL", reykjavik: "IS", reykjavík: "IS", istanbul: "TR", ankara: "TR",
  "tel aviv": "IL", dubai: "AE", "abu dhabi": "AE", riyadh: "SA", singapore: "SG", tokyo: "JP", seoul: "KR", sydney: "AU",
  melbourne: "AU", canberra: "AU", toronto: "CA", ottawa: "CA", vancouver: "CA", montreal: "CA", "montréal": "CA",
  "new york": "US", "new york city": "US", "washington dc": "US", "washington, d.c.": "US", "san francisco": "US",
  "los angeles": "US", seattle: "US", boston: "US", denver: "US", "palo alto": "US", "mountain view": "US", hawthorne: "US",
  starbase: "US", bastrop: "US", mcgregor: "US", "cape canaveral": "US", vandenberg: "US", woodinville: "US", redmond: "US",
  irvine: "US", austin: "US", "palm beach gardens": "US", "washington": "US", "new york, ny": "US", "mumbai": "IN",
  bangalore: "IN", bengaluru: "IN", delhi: "IN", hyderabad: "IN", mexico: "MX",
};

const REMOTE_RE = /\bremote\b|\bhome[- ]?office\b|\bwork from home\b/i;

const clean = (s: string) => s.trim().replace(/\s+/g, " ").replace(/^[-–—]+|[-–—]+$/g, "").trim();

function countryFromToken(token: string): string | null {
  const t = token.trim().toLowerCase().replace(/\.$/, "");
  if (COUNTRIES[t]) return COUNTRIES[t];
  const upper = token.trim().toUpperCase();
  if (upper.length === 2 && ISO_CODES.has(upper)) return upper;
  return null;
}

function parseSegment(segment: string, hint: string | null, defaultCountry: string | null): { country: string | null; city: string | null; region: string | null } {
  const parts = segment.split(",").map(clean).filter(Boolean);
  if (parts.length === 0) return { country: hint, city: null, region: null };

  const first = parts[0];
  const cityCountry = CITIES[first.toLowerCase()] ?? null;
  const last = parts[parts.length - 1];
  const lastLower = last.toLowerCase();
  const lastUpper = last.toUpperCase();

  let country: string | null = null;
  let region: string | null = null;

  if (parts.length >= 2) {
    const asCountry = countryFromToken(last);
    const looksUsState = US_STATES.has(lastUpper) || US_STATE_NAMES.has(lastLower);
    const looksCaProvince = CA_PROVINCES.has(lastUpper) || CA_PROVINCE_NAMES.has(lastLower);
    const isTwoLetter = last.length === 2;

    const countryWins = asCountry !== null && AMBIGUOUS_CODES.has(lastUpper) && cityCountry === asCountry;
    if (isTwoLetter && looksUsState && !countryWins && !(lastUpper === "CA" && parts.length >= 3)) {
      country = "US";
      region = lastUpper;
    } else if (asCountry) {
      country = asCountry;
      if (parts.length >= 3) region = parts[parts.length - 2];
    } else if (looksUsState) {
      country = "US";
      region = last;
    } else if (looksCaProvince) {
      country = "CA";
      region = last;
    } else if (parts.length >= 2) {
      const prev = parts[parts.length - 2];
      if (CA_PROVINCES.has(prev.toUpperCase()) || CA_PROVINCE_NAMES.has(prev.toLowerCase())) country = "CA";
    }
  } else {
    const bareUsState = first.length === 2 && US_STATES.has(first.toUpperCase());
    country = bareUsState && defaultCountry === "US" ? "US" : countryFromToken(first);
    if (!country && bareUsState) country = "US";
  }

  const firstIsCountry = parts.length === 1 && (countryFromToken(first) !== null || (first.length === 2 && US_STATES.has(first.toUpperCase())));
  country ??= cityCountry ?? hint;
  return { country, city: firstIsCountry ? null : first, region };
}

export function parseLocation(raw: string | null, hint?: string | null, defaultCountry?: string | null): ParsedLocation {
  const empty: ParsedLocation = { countries: [], country: null, city: null, region: null, remote: false };
  const hintCode = hint && ISO_CODES.has(hint.toUpperCase()) ? hint.toUpperCase() : null;
  if (!raw || !raw.trim()) return hintCode ? { ...empty, countries: [hintCode], country: hintCode } : empty;

  const remote = REMOTE_RE.test(raw);
  const segments = raw
    .split(/;|\||\s[-–—]\s|\s\/\s/)
    .map(clean)
    .filter((s) => s && !/^(remote|hybrid|on-?site)$/i.test(s));

  const countries: string[] = [];
  let city: string | null = null;
  let region: string | null = null;
  for (const seg of segments) {
    const cleaned = clean(seg.replace(REMOTE_RE, ""));
    if (!cleaned) continue;
    const p = parseSegment(cleaned, segments.length === 1 ? hintCode : null, defaultCountry?.toUpperCase() ?? null);
    if (p.country && !countries.includes(p.country)) countries.push(p.country);
    if (city === null && p.city && !countryFromToken(p.city)) city = p.city;
    region ??= p.region;
  }
  if (countries.length === 0 && hintCode) countries.push(hintCode);
  return { countries, country: countries[0] ?? null, city, region, remote };
}
