import { extractExperience } from "../lib/experience.ts";

const cases: [string, string, string | null][] = [
  ["5+ years of professional experience with C++", "Software Engineer", "5+ explicit"],
  ["You have 3-5 years of experience in embedded systems", "Engineer", "3-5 explicit"],
  ["Minimum of 7 years experience in GNC", "GNC Engineer", "7+ explicit"],
  ["at least five years of relevant work experience", "Analyst", "5+ explicit"],
  ["Mindestens 3 Jahre Berufserfahrung in der Softwareentwicklung", "Entwickler (m/w/d)", "3+ explicit"],
  ["Vous avez 5 ans d'expérience minimum dans le spatial", "Ingénieur", "5+ explicit"],
  ["Our company was founded 15 years ago and has experience in space", "Engineer", null],
  ["several years of experience in avionics", "Avionics Engineer", "5+ estimated"],
  ["extensive experience leading teams", "Manager", "8+ estimated"],
  ["No prior experience required, we train you", "Technician", "0 estimated"],
  ["Great team.", "Senior Systems Engineer", "5+ estimated"],
  ["Great team.", "Praktikum Softwareentwicklung (m/w/d)", "0 estimated"],
  ["Great team.", "GNC Engineer, Upper Stage", null],
  ["Great team.", "Stage analyste risque chimique", "0 estimated"],
  ["10 years of age and older; 2 years experience in Python; 6+ years of experience overall", "Engineer", "6+ explicit"],
  [
    "Basic Qualifications:\n- 3+ years of experience in C++\nPreferred Qualifications:\n- 8+ years of experience with RTOS",
    "Firmware Engineer",
    "3+ explicit",
  ],
  ["Requirements: a degree.\nNice to have: 6+ years of experience leading teams", "Engineer", "6+ estimated"],
  ["Minimum 4 lata doświadczenia na podobnym stanowisku", "Inżynier elektronik", "4+ explicit"],
  ["Wymagamy 2-3 lat doświadczenia w projektowaniu", "Konstruktor", "2-3 explicit"],
  ["Great team.", "Technik AIT - praktyki", "0 estimated"],
  ["Great team.", "Młodszy specjalista ds. IT f/m", "0-2 estimated"],
  ["Almeno 5 anni di esperienza nel settore aerospaziale", "Ingegnere", "5+ explicit"],
  ["Great team.", "Stage - Tecnologo lavorazioni meccaniche", "0 estimated"],
  ["Great team.", "Tirocinio ingegneria", "0 estimated"],
  ["a minimum of ten (10) years of relevant experience", "Program Manager", "10+ explicit"],
  ["Ten or more years of payroll experience", "Manager", "10+ explicit"],
  ["at least five (5) years of relevant experience", "Specialist", "5+ explicit"],
  ["for Senior Engineer, 7+ to 10+ years of relevant industry experience is preferred", "Senior Engineer", "7-10 explicit"],
  ["a degree, with up to 3 years of relevant experience", "Analyst", "0-3 explicit"],
];

let bad = 0;
for (const [text, title, expect] of cases) {
  const r = extractExperience(text, title);
  const got = r === null ? null : `${r.max === null ? `${r.min}+` : r.max === r.min ? `${r.min}` : `${r.min}-${r.max}`} ${r.kind}`;
  const ok = got === expect;
  if (!ok) bad++;
  console.log(ok ? "ok  " : "FAIL", JSON.stringify(title), "->", got, ok ? "" : `(expected ${expect})`);
}
console.log(bad ? `${bad} failing` : "all passing");
