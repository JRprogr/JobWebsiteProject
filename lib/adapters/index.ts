import type { Adapter, Company, DetailFetcher } from "../types.ts";
import { ashby, ashbyDetail } from "./ashby.ts";
import { bamboohr, bamboohrDetail } from "./bamboohr.ts";
import { custom, customDetail } from "./custom.ts";
import { greenhouse, greenhouseDetail } from "./greenhouse.ts";
import { lever, leverDetail } from "./lever.ts";
import { personio, personioDetail } from "./personio.ts";
import { recruitee, recruiteeDetail } from "./recruitee.ts";
import { teamtailor, teamtailorDetail } from "./teamtailor.ts";
import { workday, workdayDetail } from "./workday.ts";

const adapters: Record<Company["source_type"], Adapter> = { greenhouse, lever, custom, workday, personio, teamtailor, recruitee, bamboohr, ashby };
const details: Record<Company["source_type"], DetailFetcher> = {
  greenhouse: greenhouseDetail,
  lever: leverDetail,
  custom: customDetail,
  workday: workdayDetail,
  personio: personioDetail,
  teamtailor: teamtailorDetail,
  recruitee: recruiteeDetail,
  bamboohr: bamboohrDetail,
  ashby: ashbyDetail,
};

export function adapterFor(company: Company): Adapter {
  const adapter = adapters[company.source_type];
  if (!adapter) throw new Error(`no adapter for source_type "${company.source_type}" (${company.slug})`);
  return adapter;
}

export function detailFor(company: Company): DetailFetcher | null {
  return details[company.source_type] ?? null;
}
