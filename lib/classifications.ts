// The fixed classification taxonomy: `companies.classification` holds one of these keys. Order here is the display order.
export const CLASSIFICATIONS = [
  { key: "prime", label: "PRIME CONTRACTORS" },
  { key: "defence", label: "DEFENCE & DUAL-USE" },
  { key: "launch", label: "LAUNCH" },
  { key: "propulsion", label: "PROPULSION" },
  { key: "satellites", label: "SATELLITES & OPERATORS" },
  { key: "components", label: "COMPONENTS & SUBSYSTEMS" },
  { key: "earth-observation", label: "EARTH OBSERVATION" },
  { key: "space-ops", label: "SPACE OPERATIONS" },
  { key: "services", label: "SOFTWARE & SERVICES" },
  { key: "institutions", label: "AGENCIES & RESEARCH" },
] as const;

const LABELS = new Map<string, string>(CLASSIFICATIONS.map((s) => [s.key, s.label]));
const ORDER = new Map<string, number>(CLASSIFICATIONS.map((s, i) => [s.key, i]));

export const classificationLabel = (key: string): string => LABELS.get(key) ?? key.toUpperCase();

export const sortClassifications = (keys: string[]): string[] =>
  [...keys].sort((a, b) => (ORDER.get(a) ?? 99) - (ORDER.get(b) ?? 99) || a.localeCompare(b));
