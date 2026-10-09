// Language of a job posting, guessed from its text (or just its title). Counts how many of a language's most characteristic
// function words appear; the words were picked to be rare in the other languages ("und", "der", "pour", "och"…). Returns null
// when nothing is clear enough, which keeps the job out of a language filter rather than putting it in the wrong one.
// Computed by the scraper (lib/scrape.ts) and stored in jobs.language; `npm run scrape -- --reextract` recomputes it.

export const LANGUAGES = [
  { key: "en", label: "ENGLISH" },
  { key: "de", label: "GERMAN" },
  { key: "fr", label: "FRENCH" },
  { key: "es", label: "SPANISH" },
  { key: "it", label: "ITALIAN" },
  { key: "pt", label: "PORTUGUESE" },
  { key: "nl", label: "DUTCH" },
  { key: "pl", label: "POLISH" },
  { key: "sv", label: "SWEDISH" },
  { key: "da", label: "DANISH" },
  { key: "no", label: "NORWEGIAN" },
  { key: "fi", label: "FINNISH" },
  { key: "cs", label: "CZECH" },
] as const;

export type Language = (typeof LANGUAGES)[number]["key"];

const KEYS = new Set<string>(LANGUAGES.map((l) => l.key));

export function parseLanguages(value: string | undefined): Language[] {
  return (value ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter((v): v is Language => KEYS.has(v))
    .slice(0, LANGUAGES.length);
}

export const languageLabel = (key: string) => LANGUAGES.find((l) => l.key === key)?.label ?? key.toUpperCase();

const WORDS: Record<Language, string> = {
  en: "the and of to with you your our we will are is for that this have be as from an or their who by on at it its can all more work team experience join about role",
  de: "und der die das den dem des mit für von zu ist sind wir sie ihr ihre ein eine einen einer auf bei auch oder als aus nach über werden wird sich im zum zur durch unser unsere erfahrung bewerbung aufgaben kenntnisse",
  fr: "et les des du pour vous nous dans est sur avec que qui au aux par votre notre vos nos être avoir sont sera poste mission profil expérience entreprise équipe",
  es: "y los las para con por del que su sus al como más nuestro nuestra experiencia equipo puesto será buscamos trabajo empresa requisitos",
  it: "il che per sono della gli alla dei delle nella nel del siamo cerchiamo esperienza ricerca azienda lavoro requisiti offriamo",
  pt: "os as não uma do da em nosso nossa experiência equipa equipe vaga procuramos trabalho empresa requisitos para com mais",
  nl: "het van een voor met ons bij naar jij jouw wij onze ervaring functie werkzaamheden bent zoek ook niet zijn worden dat aan",
  pl: "i w z na do się oraz dla jest nie po przy lub że jak od co które doświadczenie praca zespół firma wymagania oferujemy poszukujemy stanowisko",
  sv: "och att det som är för med på vi du av har den till ett om kan vill vår våra erfarenhet arbete tjänst team söker",
  da: "og at er det af for med du vi som på den kan har vil vores erfaring arbejde stilling søger ikke dig vores bliver jeg også hos",
  no: "og er det for med du vi som på av den kan har vil vår våre erfaring arbeid stilling søker ikke blir deg stillingen være ønsker rollen vi søker",
  fi: "ja on ei että sekä kanssa sinä me meidän työ kokemus tehtävä tiimi etsimme olet voit osaamista",
  cs: "ve že jako nebo které pro zkušenosti práce tým hledáme pozice nabízíme požadavky",
};

const SETS = Object.fromEntries(Object.entries(WORDS).map(([k, v]) => [k, new Set(v.split(" "))])) as Record<Language, Set<string>>;

// Letters only distinctive for one language add a point per occurrence in the sample, which separates close relatives (da/no/sv, es/pt)
const MARKS: [Language, RegExp][] = [
  ["pl", /[ąćęłńóśźż]/g],
  ["cs", /[ěščřžýůď]/g],
  ["sv", /[åäö]/g],
  ["da", /[æø]/g],
  ["no", /[æø]/g],
  ["fi", /[äö]/g],
  ["de", /[ßäöü]/g],
  ["fr", /[àâçèéêëîïôûùœ]/g],
  ["es", /[ñ¿¡]/g],
  ["pt", /[ãõç]/g],
  ["it", /[àèéìòù]/g],
];

const SAMPLE_CHARS = 4000;
const MIN_HITS = 6;

export function detectLanguage(text: string | null | undefined, title = ""): Language | null {
  const sample = `${title}\n${(text ?? "").slice(0, SAMPLE_CHARS)}`.toLowerCase();
  const words = sample.match(/[\p{L}]+/gu) ?? [];
  if (words.length < 4) return null;

  const score = Object.fromEntries(LANGUAGES.map((l) => [l.key, 0])) as Record<Language, number>;
  for (const w of words) for (const l of LANGUAGES) if (SETS[l.key].has(w)) score[l.key]++;
  for (const [lang, re] of MARKS) score[lang] += Math.min(10, (sample.match(re)?.length ?? 0) / 4);
  // da and no share almost everything; "å" and "av"/"blir"/"ikke" lean Norwegian, "af" and "bliver" Danish
  if (/\bav\b|\bblir\b|\bhva\b|\bnår\b/.test(sample)) score.no += 3;
  if (/\baf\b|\bbliver\b|\bhvad\b|\bnår\b/.test(sample)) score.da += 3;

  const ranked = LANGUAGES.map((l) => [l.key, score[l.key]] as const).sort((a, b) => b[1] - a[1]);
  const best = ranked[0];
  // Danish and Norwegian are told apart by the markers above only when the text is long enough; their score is not compared with each other's
  const partner = best[0] === "da" ? "no" : best[0] === "no" ? "da" : null;
  const second = ranked.slice(1).find((r) => r[0] !== partner) ?? ranked[1];
  // a title alone ("Softwareentwickler (m/w/d)") has few words, so it needs far less evidence
  const need = (text ?? "").length < 200 ? 2 : MIN_HITS;
  if (best[1] < need || best[1] < second[1] * 1.25) return null;
  return best[0];
}
