import { htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher } from "../types.ts";
import { configString, getJson, isoPlace } from "./http.ts";
import { runBoard, type Row } from "./board.ts";

// ADP Workforce Now career centers (Intuitive Machines): a public JSON service lists requisitions 20 at a time ($top is capped) and returns
// the full description per requisition. source_config {cid, cc_id, default_country}.
type Req = {
  itemID: string;
  requisitionTitle: string;
  postDate?: string;
  requisitionDescription?: string | null;
  requisitionLocations?: { nameCode?: { shortName?: string }; address?: { cityName?: string; countrySubdivisionLevel1?: { codeValue?: string } } }[];
  customFieldGroup?: { stringFields?: { stringValue?: string; nameCode?: { codeValue?: string } }[] };
};

const BASE = "https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions";

function cfg(company: Pick<Company, "slug" | "source_config">) {
  const c = company.source_config;
  const cid = configString(c, "cid", company.slug);
  const ccId = configString(c, "cc_id", company.slug);
  return { cid, ccId, q: `cid=${cid}&ccId=${ccId}&lang=en_US` };
}

async function listAll(company: Company): Promise<Req[]> {
  const { q } = cfg(company);
  const out: Req[] = [];
  for (let skip = 0; skip < 1000; skip += 20) {
    const res = await getJson<{ jobRequisitions?: Req[]; meta?: { totalNumber?: number } }>(`${BASE}?${q}&$top=20&$skip=${skip}`);
    out.push(...(res.jobRequisitions ?? []));
    if (out.length >= (res.meta?.totalNumber ?? 0) || !res.jobRequisitions?.length) break;
  }
  return out;
}

async function fullText(company: Pick<Company, "slug" | "source_config">, id: string): Promise<string | null> {
  const r = await getJson<Req>(`${BASE}/${id}?${cfg(company).q}`);
  return r.requisitionDescription ? htmlToText(r.requisitionDescription) || null : null;
}

export const adpDetail: DetailFetcher = async (company, job) => fullText(company, job.external_id);

export const adp: Adapter = async (company, ctx) => {
  const { cid, ccId } = cfg(company);
  const rows = (await listAll(company)).map((r): Row => {
    const loc = r.requisitionLocations?.[0];
    // " Houston, TX, US": the trailing ISO code goes over as a hint ("Remote - NC, NC, US"), bare places fall back to default_country
    const { place, country } = isoPlace(loc?.nameCode?.shortName?.trim() || loc?.address?.cityName || null);
    const job = r.customFieldGroup?.stringFields?.find((f) => f.nameCode?.codeValue === "ExternalJobID")?.stringValue;
    return {
      id: r.itemID,
      url: `https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=${cid}&ccId=${ccId}${job ? `&jobId=${job}` : ""}&lang=en_US`,
      title: r.requisitionTitle,
      location: place,
      remote: /\bremote\b/i.test(`${r.requisitionTitle} ${loc?.nameCode?.shortName ?? ""}`),
      posted: r.postDate ? new Date(r.postDate).toISOString() : null,
      country,
    };
  });
  return runBoard(company, ctx, rows, (r) => fullText(company, r.id));
};
