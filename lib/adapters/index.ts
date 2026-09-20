import type { Adapter, Company, DetailFetcher } from "../types.ts";
import { custom, customDetail } from "./custom.ts";
import { greenhouse, greenhouseDetail } from "./greenhouse.ts";
import { lever, leverDetail } from "./lever.ts";

const adapters: Partial<Record<Company["source_type"], Adapter>> = { greenhouse, lever, custom };
const details: Partial<Record<Company["source_type"], DetailFetcher>> = {
  greenhouse: greenhouseDetail,
  lever: leverDetail,
  custom: customDetail,
};

export function adapterFor(company: Company): Adapter {
  const adapter = adapters[company.source_type];
  if (!adapter) throw new Error(`no adapter for source_type "${company.source_type}" (${company.slug})`);
  return adapter;
}

export function detailFor(company: Company): DetailFetcher | null {
  return details[company.source_type] ?? null;
}
