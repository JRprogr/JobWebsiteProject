export type Company = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  sector: string | null;
  source_type: "greenhouse" | "lever" | "workday" | "custom";
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
};

export type Adapter = (company: Company) => Promise<NormalizedJob[]>;
