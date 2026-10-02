// The sort options, kept apart from lib/jobs.ts on purpose: that module imports the database driver, and a client component
// (ResultsBar) that imported SORTS from it pulled the driver into the browser bundle.
export type Sort = "latest" | "oldest" | "az" | "za";

export const SORTS: { value: Sort; label: string }[] = [
  { value: "latest", label: "LATEST" },
  { value: "oldest", label: "OLDEST" },
  { value: "az", label: "A–Z" },
  { value: "za", label: "Z–A" },
];

export function parseSort(value: string | undefined): Sort {
  return SORTS.some((s) => s.value === value) ? (value as Sort) : "latest";
}
