import { decodeEntities, extractElement, htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher } from "../types.ts";
import { configString, getText } from "./http.ts";
import { runBoard, strip, type Row } from "./board.ts";

// Config-driven adapter for a small career page that links to one page per job (used as the custom kind "link-list"; KP Labs,
// Liftero, Latitude, Esyen, Andøya Space). source_config:
//   list_url        the page with the links (optional page_template with "{n}" + max_pages when the list is paged)
//   link_regex      group 1 = the link (absolute or root-relative); may include surrounding markup to scope it
//   body_marker     opening-tag fragment of the element that holds the listing text
//   title_regex     group 1 on the job page; default is its first <h1>
//   id_regex        group 1 on the link; default is the last path segment
//   location_regex  group 1 on the job page (optional)
//   default_country ISO-2
// Each new job page is read once (the title lives there); known jobs are not fetched again. Capped at 40 links.
function cfg(company: Pick<Company, "slug" | "source_config">) {
  const c = company.source_config;
  const re = (key: string) => (typeof c[key] === "string" ? new RegExp(c[key] as string) : null);
  return {
    list: configString(c, "list_url", company.slug),
    template: typeof c.page_template === "string" ? c.page_template : null,
    maxPages: typeof c.max_pages === "number" ? c.max_pages : 1,
    link: new RegExp(configString(c, "link_regex", company.slug), "g"),
    body: configString(c, "body_marker", company.slug),
    title: re("title_regex"),
    id: re("id_regex"),
    location: re("location_regex"),
  };
}

type Cfg = ReturnType<typeof cfg>;

const pageOf = (html: string, k: Pick<Cfg, "body" | "title" | "location">) => {
  const title = k.title ? k.title.exec(html)?.[1] : /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1];
  const el = extractElement(html, k.body);
  const found = k.location?.exec(html)?.[1];
  // "Gliwice (hybrid)": the work mode is not part of the place
  const mode = found ? /\((remote|hybrid|on-?site)\)\s*$/i.exec(found)?.[1].toLowerCase() : undefined;
  // ...and Italian province codes ("Avezzano (AQ)") are noise too
  const place = found ? strip(found).replace(/\s*\((?:remote|hybrid|on-?site)\)$/i, "").replace(/\s*\([A-Z]{2}\)/g, "") : "";
  return { title: title ? strip(title) : null, text: el ? htmlToText(el) || null : null, location: place || null, remote: mode === "remote" };
};

export const linkListDetail: DetailFetcher = async (company, job) => pageOf(await getText(job.url), cfg(company)).text;

async function links(k: Cfg): Promise<string[]> {
  const found = new Set<string>();
  for (let n = 1; n <= k.maxPages; n++) {
    const before = found.size;
    const url = k.template ? k.template.replace("{n}", String(n)) : k.list;
    const html = await getText(url).catch((e: unknown) => {
      if (n === 1) throw e;
      return "";
    });
    for (const m of html.matchAll(k.link)) found.add(new URL(decodeEntities(m[1]), url).toString());
    if (found.size === before) break;
  }
  return [...found].slice(0, 40);
}

export const linkList: Adapter = async (company, ctx) => {
  const k = cfg(company);
  const rows: Row[] = [];
  for (const url of await links(k)) {
    const id = k.id?.exec(url)?.[1] ?? new URL(url).pathname.split("/").filter(Boolean).pop() ?? url;
    // an already processed job keeps its stored title and location; its page is not read again (saves a request per job per run)
    const known = ctx.known.get(id);
    if (known) {
      rows.push({ id, url, title: known, location: null, text: null });
      continue;
    }
    try {
      const p = pageOf(await getText(url), k);
      if (p.title) rows.push({ id, url, title: p.title, location: p.location, remote: p.remote, text: p.text ?? "" });
    } catch {
      // a page that fails to load is retried on the next run
    }
  }
  return runBoard(company, ctx, rows, async () => null);
};
