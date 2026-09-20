import type { Adapter, NormalizedJob } from "../types.ts";

type GhJob = {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string } | null;
  first_published?: string | null;
  updated_at?: string | null;
  pay_input_ranges?: { min_cents: number; max_cents: number; currency_type: string }[] | null;
};

type GhDepartment = { name: string; jobs?: { id: number }[]; children?: GhDepartment[] };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`greenhouse ${res.status} for ${url}`);
  return (await res.json()) as T;
}

function departmentIndex(depts: GhDepartment[]): Map<number, string> {
  const byJob = new Map<number, string>();
  const walk = (d: GhDepartment) => {
    for (const j of d.jobs ?? []) if (!byJob.has(j.id)) byJob.set(j.id, d.name);
    d.children?.forEach(walk);
  };
  depts.forEach(walk);
  return byJob;
}

export const greenhouse: Adapter = async (company) => {
  const token = company.source_config.board_token;
  if (typeof token !== "string") throw new Error(`${company.slug}: source_config.board_token missing`);
  const base = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}`;

  const [{ jobs }, { departments }] = await Promise.all([
    getJson<{ jobs: GhJob[] }>(`${base}/jobs`),
    getJson<{ departments: GhDepartment[] }>(`${base}/departments`),
  ]);
  const deptByJob = departmentIndex(departments);

  return jobs.map((j): NormalizedJob => {
    const pay = j.pay_input_ranges?.[0];
    const location = j.location?.name?.trim() || null;
    return {
      external_id: String(j.id),
      title: j.title.trim(),
      location_raw: location,
      remote: /\bremote\b/i.test(location ?? ""),
      department: deptByJob.get(j.id) ?? null,
      url: j.absolute_url,
      salary_min: pay ? Math.round(pay.min_cents / 100) : null,
      salary_max: pay ? Math.round(pay.max_cents / 100) : null,
      salary_currency: pay?.currency_type ?? null,
      posted_at: j.first_published ?? j.updated_at ?? null,
    };
  });
};
