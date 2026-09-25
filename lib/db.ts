import { neon } from "@neondatabase/serverless";

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

let client: ReturnType<typeof connect> | undefined;

export function sql() {
  client ??= connect();
  return client;
}

// The Neon HTTP driver opens a fresh connection per statement, and one that fails while connecting is worth another try.
// Every statement the scraper runs is safe to repeat (selects, upserts and updates keyed on the same run).
export async function retryDb<T>(run: () => PromiseLike<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      if (attempt === attempts || !/Error connecting to database/.test(String(err))) throw err;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
}
