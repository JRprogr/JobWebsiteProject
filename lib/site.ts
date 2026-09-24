// Set NEXT_PUBLIC_SITE_URL in the deploy environment once the domain is known; falls back to localhost for dev.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const CONTACT_EMAIL = "info.dscareers@proton.me";

export const TIP_URL = "https://ko-fi.com/johndscareers";
export const TIP_LABEL = "TIP";

// Placeholders: the privacy policy (and any future imprint) must name the person responsible. Swap in the real values.
export const CONTROLLER_NAME = "[Full name — to be added]";
export const CONTROLLER_ADDRESS = "[Postal address — to be added]";
