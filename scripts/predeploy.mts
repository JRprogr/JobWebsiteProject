// Runs before `next build`. On a Vercel production deploy it applies pending migrations and syncs the company list, so a push
// to main ships code and database together and a failing migration stops the deploy before it goes live.
// Local and preview builds skip it and never touch a database.
if (process.env.VERCEL_ENV !== "production") {
  console.log(`predeploy: skipped (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"})`);
} else {
  await import("./migrate.mts");
  await import("./seed.mts");
}
