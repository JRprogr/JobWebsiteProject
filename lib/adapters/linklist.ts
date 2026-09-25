import { decodeEntities, extractElement, htmlToText } from "../text.ts";
import type { Adapter, Company, DetailFetcher } from "../types.ts";
import { configString, getText } from "./http.ts";
import { runBoard, strip, type Row } from "./board.ts";

// Config-driven adapter for small career pages without an ATS (custom kind "link-list"). Three shapes, chosen by which key is set:
//  * one page per job: `link_regex` (group 1 = the link, absolute or root-relative; may include surrounding markup to scope it).
//    Each new job page is read once; its title comes from `title_regex` (group 1), the <title> tag without its site-name suffix
//    when `title_tag` is true, or else the first <h1>.
//  * embedded JSON: `json_regex`, `json_path`, `json_map` (see fromJson).
//  * everything on one page: `item_regex` (global; group 1 or named group `title`, optional named groups `location` (or `city` + `country`) and `url`). A job's text is the HTML between its
//    match and the next one; the last job ends at the `item_end` marker (else 8,000 characters on).
// Common keys: list_url (+ page_template with "{n}" and max_pages for a paged list), body_marker (opening-tag fragment of the element
// with the listing text; default <main>, <article> or the whole page), id_regex (group 1 on the link; default last path segment),
// location_regex (group 1 on the job page or the item block), title_skip and location_strip (regexes), fetch_text (item mode: read the text from each item url), default_country (ISO-2).
function cfg(company: Pick<Company, "slug" | "source_config">) {
  const c = company.source_config;
  const re = (key: string, flags = "") => (typeof c[key] === "string" ? new RegExp(c[key] as string, flags) : null);
  return {
    list: configString(c, "list_url", company.slug),
    template: typeof c.page_template === "string" ? c.page_template : null,
    maxPages: typeof c.max_pages === "number" ? c.max_pages : 1,
    link: re("link_regex", "g"),
    item: re("item_regex", "g"),
    itemEnd: typeof c.item_end === "string" ? c.item_end : null,
    fetchText: c.fetch_text === true,
    body: typeof c.body_marker === "string" ? c.body_marker : null,
    title: re("title_regex"),
    titleTag: c.title_tag === true,
    id: re("id_regex"),
    location: re("location_regex"),
  };
}

type Cfg = ReturnType<typeof cfg>;

// "Gliwice (hybrid)": the work mode is not part of the place, and Italian province codes ("Avezzano (AQ)") are noise too
function place(found: string | undefined): { location: string | null; remote: boolean } {
  if (!found) return { location: null, remote: false };
  const remote = /\(remote\)\s*$/i.test(found);
  return { location: strip(found).replace(/\s*\((?:remote|hybrid|on-?site)\)$/i, "").replace(/\s*\([A-Z]{2}\)/g, "") || null, remote };
}

const bodyOf = (html: string, marker: string | null) => {
  // without a marker: <main>, <article>, else the page from its first <h1> on (drops the site header and menu)
  const h1 = html.indexOf("<h1");
  const el = (marker && extractElement(html, marker)) || extractElement(html, "<main") || extractElement(html, "<article") || (h1 >= 0 ? html.slice(h1) : html);
  return htmlToText(el.replace(/<(script|style|nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, "")).replace(/^[•\s]+/, "") || null;
};

// "FEM Engineer - PIAP Space" -> "FEM Engineer": the last segment of a <title> is the site name
function tagTitle(html: string): string | undefined {
  const raw = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  if (!raw) return undefined;
  const parts = strip(raw).split(/\s+[-–—|]\s+/);
  return (parts.length > 1 ? parts.slice(0, -1) : parts).join(" - ");
}

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const linkListDetail: DetailFetcher = async (company, job) => {
  const k = cfg(company);
  if (k.item && !k.fetchText) return (await fromItems(k)).find((r) => r.id === job.external_id)?.text || null;
  return bodyOf(await getText(job.url), k.body);
};

async function fetchAll(k: Cfg): Promise<string[]> {
  const found = new Set<string>();
  for (let n = 1; n <= k.maxPages; n++) {
    const before = found.size;
    const url = k.template ? k.template.replace("{n}", String(n)) : k.list;
    const html = await getText(url).catch((e: unknown) => {
      if (n === 1) throw e;
      return "";
    });
    for (const m of html.matchAll(k.link!)) found.add(new URL(decodeEntities(m[1]), url).toString());
    if (found.size === before) break;
  }
  return [...found].slice(0, 40);
}

async function fromPages(k: Cfg, ctx: Parameters<Adapter>[1]): Promise<Row[]> {
  const rows: Row[] = [];
  for (const url of await fetchAll(k)) {
    const id = k.id?.exec(url)?.[1] ?? new URL(url).pathname.split("/").filter(Boolean).pop() ?? url;
    // an already processed job keeps its stored title and location; its page is not read again (saves a request per job per run)
    const known = ctx.known.get(id);
    if (known) {
      rows.push({ id, url, title: known, location: null, text: null });
      continue;
    }
    try {
      const html = await getText(url);
      const title = k.title ? k.title.exec(html)?.[1] : k.titleTag ? tagTitle(html) : /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1];
      if (title) rows.push({ id, url, title: strip(title), ...place(k.location?.exec(html)?.[1]), text: bodyOf(html, k.body) ?? "" });
    } catch {
      // a page that fails to load is retried on the next run
    }
  }
  return rows;
}

async function fromItems(k: Cfg): Promise<Row[]> {
  const html = await getText(k.list);
  const hits = [...html.matchAll(k.item!)];
  return hits.map((m, i): Row => {
    const from = m.index + m[0].length;
    const end = hits[i + 1]?.index ?? (k.itemEnd && html.indexOf(k.itemEnd, from) > 0 ? html.indexOf(k.itemEnd, from) : from + 8000);
    const cut = html.slice(from, end);
    // the next item starts inside a tag, so drop a trailing unfinished tag
    const block = cut.lastIndexOf("<") > cut.lastIndexOf(">") ? cut.slice(0, cut.lastIndexOf("<")) : cut;
    const g = m.groups ?? {};
    const title = strip(g.title ?? m[1]);
    const link = g.url ? new URL(decodeEntities(g.url), k.list).toString() : k.list;
    const where = g.location ?? ([g.city, g.country].filter(Boolean).join(", ") || k.location?.exec(block)?.[1]);
    // a job with its own page has its text fetched from there (item blocks are then just table cells)
    const text = g.url && k.fetchText ? undefined : htmlToText((m[0].startsWith("<") ? m[0] : m[0].replace(/^[^<>]*>/, "")) + block);
    return { id: k.id?.exec(link)?.[1] ?? slug(title), url: link, title, ...place(where), text };
  });
}

// JSON embedded in the page (a Vue prop, a script blob): json_regex group 1 is the JSON text (HTML entities allowed), json_path an optional
// dotted path to the array inside it, json_map names the fields per job: {id?, title, location?, department?, url?}. Listing text is
// fetched from each job's url with body_marker when there is one.
async function fromJson(k: Cfg, c: Record<string, unknown>): Promise<Row[]> {
  const raw = new RegExp(String(c.json_regex)).exec(await getText(k.list))?.[1];
  if (!raw) return [];
  const pick = (o: unknown, path: string): unknown => path.split(".").filter(Boolean).reduce<unknown>((v, key) => (v as Record<string, unknown> | undefined)?.[key], o);
  const list = pick(JSON.parse(decodeEntities(raw)), typeof c.json_path === "string" ? c.json_path : "") ;
  const map = (c.json_map ?? {}) as Record<string, string>;
  const field = (job: unknown, name: string) => (map[name] ? String(pick(job, map[name]) ?? "") : "");
  return (Array.isArray(list) ? list : []).flatMap((job): Row[] => {
    const title = strip(field(job, "title"));
    if (!title) return [];
    const url = field(job, "url") ? new URL(field(job, "url"), k.list).toString() : k.list;
    return [{ id: field(job, "id") || slug(title), url, title, ...place(field(job, "location") || undefined), department: field(job, "department") || null }];
  });
}

export const linkList: Adapter = async (company, ctx) => {
  const k = cfg(company);
  const c = company.source_config;
  if (!k.link && !k.item && typeof c.json_regex !== "string") throw new Error(`${company.slug}: source_config needs link_regex, item_regex or json_regex`);
  // optional clean-ups: title_skip drops placeholder or non-job entries, location_strip removes a prefix/suffix from the place
  const skip = typeof c.title_skip === "string" ? new RegExp(c.title_skip, "i") : null;
  const strippedPlace = typeof c.location_strip === "string" ? new RegExp(c.location_strip, "gi") : null;
  const tidy = (rows: Row[]) =>
    rows
      .filter((r) => r.title && !skip?.test(r.title))
      .map((r) => (strippedPlace && r.location ? { ...r, location: r.location.replace(strippedPlace, "").trim() || null } : r));
  if (k.item) return runBoard(company, ctx, tidy(await fromItems(k)), async (r) => bodyOf(await getText(r.url), k.body));
  if (k.link) return runBoard(company, ctx, tidy(await fromPages(k, ctx)), async () => null);
  return runBoard(company, ctx, tidy(await fromJson(k, c)), async (r) => (r.url === k.list ? null : bodyOf(await getText(r.url), k.body)));
};
