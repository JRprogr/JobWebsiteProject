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
