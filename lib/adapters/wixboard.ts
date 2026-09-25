import { htmlToText } from "../text.ts";
import type { Adapter, DetailFetcher } from "../types.ts";
import { configString, getText } from "./http.ts";
import { runBoard, strip, type Row } from "./board.ts";

// A Wix site whose jobs page is a repeater of cards (title, location, "View Job" link), e.g. jobs.infiniteorbits.io/jobs; the job page
// is another Wix page whose listing text sits between the "Apply Now" button and the footer. Used as the custom kind "wix-board".
export function parseCards(html: string): Row[] {
  return html
    .split('role="listitem"')
    .slice(1)
    .flatMap((chunk): Row[] => {
      const link = /href="(https?:\/\/[^"]+\/jobs\/[^"]+)"[^>]*aria-label="View Job"/.exec(chunk)?.[1];
      const title = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(chunk)?.[1];
      const place = /<p[^>]*>([\s\S]*?)<\/p>/.exec(chunk)?.[1];
      if (!link || !title) return [];
      return [{ id: decodeURIComponent(link.split("/jobs/")[1]), url: link, title: strip(title), location: place ? strip(place) || null : null }];
    });
}

async function fetchText(url: string): Promise<string | null> {
  const text = htmlToText((await getText(url)).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ""));
  const start = text.indexOf("Apply Now");
  const end = text.indexOf("Follow us on", start);
  if (start < 0 || end < 0) return null;
  // the location and job type line sits right after the button; the description starts at the first heading after it
  return text.slice(start + "Apply Now".length, end).trim() || null;
}

export const wixBoardDetail: DetailFetcher = async (_company, job) => fetchText(job.url);

export const wixBoard: Adapter = async (company, ctx) =>
  runBoard(company, ctx, parseCards(await getText(configString(company.source_config, "list_url", company.slug))), (r) => fetchText(r.url));
