export type Company = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  classification: string | null;
  source_type: "greenhouse" | "lever" | "workday" | "personio" | "teamtailor" | "recruitee" | "bamboohr" | "ashby" | "successfactors" | "factorial" | "hibob" | "skeeled" | "odoo" | "eightfold" | "cornerstone" | "workable" | "ultipro" | "jibe" | "talentbrew" | "talentsoft" | "clinch" | "peopleforce" | "hron" | "intervieweb" | "clarityloop" | "oraclecloud" | "adp" | "none" | "custom";
  source_config: Record<string, unknown>;
  active: boolean;
};

export type NormalizedJob = {
  external_id: string;
  title: string;
  location_raw: string | null;
  remote: boolean;
  department: string | null;
  url: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  posted_at: string | null;
  country_hint?: string | null;
  // Plain-text listing body, only set for postings not processed before; used for experience extraction, never stored.
  description?: string | null;
};

export type AdapterContext = {
  // external_id -> title for jobs whose details were already processed (their title is authoritative)
  known: Map<string, string>;
  // CLI backfill: allow far more detail fetches than a cron run
  backfill: boolean;
};

export type Adapter = (company: Company, ctx: AdapterContext) => Promise<NormalizedJob[]>;

// Returns the plain-text listing body for one job, or null when the source has none.
export type DetailFetcher = (company: Company, job: { external_id: string; url: string }) => Promise<string | null>;
