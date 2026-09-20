import type { Adapter, Company } from "../types.ts";
import { greenhouse } from "./greenhouse.ts";
import { custom } from "./custom.ts";
import { lever } from "./lever.ts";

const registry: Partial<Record<Company["source_type"], Adapter>> = { greenhouse, lever, custom };

export function adapterFor(company: Company): Adapter {
  const adapter = registry[company.source_type];
  if (!adapter) throw new Error(`no adapter for source_type "${company.source_type}" (${company.slug})`);
  return adapter;
}
