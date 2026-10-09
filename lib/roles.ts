// Role type: a coarse, employer-independent grouping of what a job is, read from its title (and the source's department when the
// title says nothing). Sources name departments in their own way ("Eng", "R&D", "Operations"), so the type is derived here instead.
// The first matching rule wins, so the order matters: "Sales Engineer" is sales, "HR Manager" is HR, "Software Engineering Manager"
// is management. Computed by the scraper (lib/scrape.ts) and stored in jobs.role_type; `npm run scrape -- --reextract` recomputes it.

export const ROLE_TYPES = [
  { key: "engineering", label: "ENGINEERING" },
  { key: "software", label: "SOFTWARE & DATA" },
  { key: "science", label: "SCIENCE & RESEARCH" },
  { key: "operations", label: "PRODUCTION & OPERATIONS" },
  { key: "management", label: "MANAGEMENT" },
  { key: "business", label: "SALES & MARKETING" },
  { key: "corporate", label: "FINANCE, LEGAL & HR" },
  { key: "student", label: "INTERNS & STUDENTS" },
  { key: "other", label: "OTHER" },
] as const;

export type RoleType = (typeof ROLE_TYPES)[number]["key"];

const KEYS = new Set<string>(ROLE_TYPES.map((r) => r.key));

export function parseRoleTypes(value: string | undefined): RoleType[] {
  return (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v): v is RoleType => KEYS.has(v))
    .slice(0, ROLE_TYPES.length);
}

export const roleTypeLabel = (key: string) => ROLE_TYPES.find((r) => r.key === key)?.label ?? key.toUpperCase();

// no trailing \b on stems that carry endings or non-ASCII letters (JS \b treats ä, é, ł… as non-word characters)
const RULES: [RoleType, RegExp][] = [
  ["student", /\b(?:intern(?:ship)?s?|interns|praktik\w*|werkstudent\w*|working student|thesis|abschlussarbeit|masterarbeit|bachelorarbeit|diplomarbeit|stagiaire|apprentice\w*|apprenti\w*|ausbildung|azubi|student\w*|studentische|hiwi|co-?op|trainee|graduate (?:programme|program|scheme)|tirocini\w*|stagist\w*|estágio|estagiári\w*|prácticas|becari\w*|phd (?:student|candidate|position)|doctoral)\b|\b(?:staż|stażyst|praktyk[ia])|^\s*stage\b/i],
  ["business", /\b(?:sales|business development|marketing|account (?:manager|executive|director)|customer (?:success|support|service|relations)|brand|partnerships?|public relations|content (?:manager|creator|writer|specialist)|social media|vertrieb\w*|growth|pre-?sales|ventas|vendite|(?:communications?|commercial|comercial|commerciale) (?:manager|specialist|lead|officer|coordinator|director|executive|assistant|analyst)|estágio comercial)\b/i],
  ["corporate", /\b(?:financ\w*|accountant|accounting|controller|controlling|payroll|treasury|tax|audit\w*|legal|counsel|paralegal|compliance|contracts?|procurement|buyer|purchas\w*|acheteu\w*|approvisionn\w*|einkäufer\w*|human resources|hr|recruit\w*|talent|people (?:partner|business|operations|&|and)|office (?:admin\w*|manager|assistant)|admin\w*|assistant|receptionist|secretary|facilit\w*|export control\w*|trade compliance|sourcing|einkauf\w*|personal\w*|buchhal\w*|jurist\w*|rechts\w*)\b/i],
  ["management", /\b(?:manager|manageress|director|head of|vp|vice president|chief|president|superintendent|managing|leiter\w*|direktor\w*|geschäftsführ\w*|responsable|directeur|directrice|dirigente|direttore|gerente|jefe|kierownik\w*|dyrektor\w*|team lead\w*|programme lead|program lead)\b/i],
  ["operations", /\b(?:technician\w*|techniker\w*|technicien\w*|tecnico|técnico|technik|elektromechanik\w*)\b/i],
  ["software", /\b(?:software|sw|erp|sap|it|firmware|developer|devops|devsecops|sre|backend|back-end|frontend|front-end|full[- ]?stack|data (?:scientist|engineer|analyst|architect|science)|machine learning|ml engineer|ai engineer|\bai\b|cloud|cyber\w*|information security|infosec|it (?:support|specialist|engineer|administrator|manager|analyst|technician)|sysadmin|system administrator|network (?:engineer|administrator)|embedded|fpga|programmer|entwickler\w*|développeur\w*|sviluppatore\w*|desarrollador\w*|programista|informatik\w*|database|dba|qa engineer|test automation|site reliability)\b/i],
  ["science", /\b(?:scientist|researcher|research (?:fellow|associate|assistant|engineer|scientist|officer)|physicist|chemist|mathematician|astronom\w*|geolog\w*|postdoc\w*|post-doc\w*|professor|lecturer|wissenschaft\w*|forscher\w*|forschung\w*|chercheu\w*|ricercator\w*|investigador\w*|naukow\w*|r&d specialist|laboratory (?:specialist|analyst)|lab (?:specialist|analyst))\b/i],
  ["engineering", /\b(?:engineer\w*|ingenieur\w*|ingénieur\w*|ingegner\w*|ingenier\w*|inżynier\w*|architect|designer|draft(?:s)?man|cad|gnc|aocs|avionics|propulsion|structures?|thermal|systems? (?:specialist|analyst)|konstrukteur\w*|entwicklung\w*|conception|projet\w*|progettista|tecnico progettista|specialist engineer|subject matter expert|sme)\b/i],
  ["operations", /\b(?:inspekt\w*|quality|jakości|planist\w*|planner|scheduler|planning|inventory|material\w*|shop ?floor|security officer|operator\w*|operat\w+|assembler|assembly|machinist|welder|welding|production|manufacturing|fertigung\w*|monteur\w*|mechanic\w*|mechaniker\w*|electrician|elektriker\w*|logistic\w*|warehouse\w*|supply chain|shipping|driver|pilot|inspector|inspection|quality (?:assurance|control|inspector|specialist|technician)|maintenance|instandhaltung\w*|cleanroom|clean room|facility technician|test (?:technician|operator|lead)|flight (?:operations|controller|dynamics)|mission (?:operations|controller)|ground station|launch (?:operations|site)|range (?:operations|safety)|safety officer|hse|ehs|ops|installer|fitter|carpenter|painter|coater|plater|cnc|integration technician)\b/i],
];

export function roleType(title: string, department?: string | null): RoleType {
  for (const [type, re] of RULES) if (re.test(title)) return type;
  if (department) for (const [type, re] of RULES) if (type !== "student" && re.test(department)) return type;
  return "other";
}
