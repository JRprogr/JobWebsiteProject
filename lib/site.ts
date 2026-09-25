// Set NEXT_PUBLIC_SITE_URL once the site has its own domain. Until then a Vercel deploy uses its own production URL
// (VERCEL_PROJECT_PRODUCTION_URL, no scheme); local dev falls back to localhost.
const VERCEL_HOST = process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (VERCEL_HOST ? `https://${VERCEL_HOST}` : "http://localhost:3000");

export const CONTACT_EMAIL = "info.dscareers@proton.me";

export const TIP_URL = "https://ko-fi.com/johndscareers";
export const TIP_LABEL = "TIP";

// The person responsible for the site: shown on the Impressum and named as the controller on the Privacy page.
// Kept out of the repository: set OPERATOR_NAME and OPERATOR_ADDRESS (address lines separated by "|") in the environment.
// A production build refuses to deploy without them (scripts/predeploy.mts).
export const OPERATOR_NAME = process.env.OPERATOR_NAME?.trim() || "[OPERATOR_NAME not set]";
export const OPERATOR_ADDRESS = (process.env.OPERATOR_ADDRESS ?? "[OPERATOR_ADDRESS not set]").split("|").map((line) => line.trim()).filter(Boolean);
