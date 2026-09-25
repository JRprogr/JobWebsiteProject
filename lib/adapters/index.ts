import type { Adapter, Company, DetailFetcher } from "../types.ts";
import { clinch, clinchDetail } from "./clinch.ts";
import { cornerstone, cornerstoneDetail } from "./cornerstone.ts";
import { eightfold, eightfoldDetail } from "./eightfold.ts";
import { jibe, jibeDetail } from "./jibe.ts";
import { talentbrew, talentbrewDetail } from "./talentbrew.ts";
import { talentsoft, talentsoftDetail } from "./talentsoft.ts";
import { ultipro, ultiproDetail } from "./ultipro.ts";
import { workable, workableDetail } from "./workable.ts";
import { ashby, ashbyDetail } from "./ashby.ts";
import { bamboohr, bamboohrDetail } from "./bamboohr.ts";
import { custom, customDetail } from "./custom.ts";
import { factorial, factorialDetail } from "./factorial.ts";
import { greenhouse, greenhouseDetail } from "./greenhouse.ts";
import { hibob, hibobDetail } from "./hibob.ts";
import { lever, leverDetail } from "./lever.ts";
import { odoo, odooDetail } from "./odoo.ts";
import { personio, personioDetail } from "./personio.ts";
import { recruitee, recruiteeDetail } from "./recruitee.ts";
import { skeeled, skeeledDetail } from "./skeeled.ts";
import { successfactors, successfactorsDetail } from "./successfactors.ts";
import { teamtailor, teamtailorDetail } from "./teamtailor.ts";
import { workday, workdayDetail } from "./workday.ts";

const adapters: Record<Company["source_type"], Adapter> = { greenhouse, lever, custom, workday, personio, teamtailor, recruitee, bamboohr, ashby, successfactors, factorial, hibob, skeeled, odoo, clinch, cornerstone, eightfold, jibe, talentbrew, talentsoft, ultipro, workable };
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
  successfactors: successfactorsDetail,
  factorial: factorialDetail,
  hibob: hibobDetail,
  skeeled: skeeledDetail,
  odoo: odooDetail,
  clinch: clinchDetail,
  cornerstone: cornerstoneDetail,
  eightfold: eightfoldDetail,
  jibe: jibeDetail,
  talentbrew: talentbrewDetail,
  talentsoft: talentsoftDetail,
  ultipro: ultiproDetail,
  workable: workableDetail,
};

export function adapterFor(company: Company): Adapter {
  const adapter = adapters[company.source_type];
  if (!adapter) throw new Error(`no adapter for source_type "${company.source_type}" (${company.slug})`);
  return adapter;
}

export function detailFor(company: Company): DetailFetcher | null {
  return details[company.source_type] ?? null;
}
