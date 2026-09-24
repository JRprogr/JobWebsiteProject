import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Job listings surface only inside the filtered Overview (no dedicated /jobs/[id] pages), so this stays a short, static list.
const ROUTES: { path: string; changeFrequency: "hourly" | "weekly"; priority: number }[] = [
  { path: "", changeFrequency: "hourly", priority: 1 },
  { path: "/statistics", changeFrequency: "hourly", priority: 0.6 },
  { path: "/companies", changeFrequency: "weekly", priority: 0.6 },
  { path: "/about", changeFrequency: "weekly", priority: 0.4 },
  { path: "/faq", changeFrequency: "weekly", priority: 0.4 },
  { path: "/terms", changeFrequency: "weekly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "weekly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((r) => ({ url: `${SITE_URL}${r.path}`, lastModified: now, changeFrequency: r.changeFrequency, priority: r.priority }));
}
