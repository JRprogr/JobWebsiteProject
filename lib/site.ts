// Set NEXT_PUBLIC_SITE_URL in the deploy environment once the domain is known; falls back to localhost for dev.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Placeholders pending real accounts; swap the values below once they exist.
export const CONTACT_EMAIL = "[@Placeholder]";

// TODO: replace with the real Ko-fi/Stripe tip link once the account is set up.
export const TIP_URL = "#";
export const TIP_LABEL = "TIP";
