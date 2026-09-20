import { getJobDetails } from "@/lib/details";

export async function GET(_request: Request, ctx: RouteContext<"/api/jobs/[id]/details">) {
  const { id } = await ctx.params;
  try {
    const details = await getJobDetails(id);
    if (!details) return Response.json({ error: "No listing text available" }, { status: 404 });
    return Response.json(details, { headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=86400" } });
  } catch {
    return Response.json({ error: "The employer site could not be reached" }, { status: 502 });
  }
}
