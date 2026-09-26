// Runs before `next build`. On a Vercel production deploy it applies pending migrations and syncs the company list, so a push
// to main ships code and database together and a failing migration stops the deploy before it goes live.
// Local and preview builds skip it and never touch a database.
if (process.env.VERCEL_ENV !== "production") {
  console.log(`predeploy: skipped (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"})`);
} else {
  // The Impressum is a legal requirement and its data lives only in the environment (lib/site.ts), never in the repository.
  const missing = ["OPERATOR_NAME", "OPERATOR_ADDRESS"].filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) throw new Error(`predeploy: ${missing.join(" and ")} must be set, the Impressum needs them`);

  // Optional: the running site can use a read-only database role (README, "Security and cost safety"). Only a deploy needs to
  // change the schema, and it does so with this second, more powerful connection string.
  if (process.env.DATABASE_ADMIN_URL) process.env.DATABASE_URL = process.env.DATABASE_ADMIN_URL;

  await import("./migrate.mts");
  await import("./seed.mts");
}
