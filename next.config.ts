import type { NextConfig } from "next";

// Content-Security-Policy: everything comes from our own origin. 'unsafe-inline' stays for scripts and styles because Next inlines
// its page data and the theme script, and the components use style attributes; nothing here renders untrusted HTML (listing
// texts are shown as plain text), so the policy's job is to stop foreign scripts, frames, forms and plug-ins.
// 'unsafe-eval' is only for the development server's hot reloading.
const dev = process.env.NODE_ENV !== "production";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${dev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// The three pages that read the database on every request. They look the same for every visitor and the data changes hourly,
// so the CDN may serve one rendering for five minutes (and a stale one for half an hour while it refreshes). Without this
// every page view, and every bot request, wakes the database and counts as a function invocation.
const PAGE_CACHE = "public, max-age=0, s-maxage=300, stale-while-revalidate=1800";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      ...["/", "/companies", "/statistics"].map((source) => ({ source, headers: [{ key: "Cache-Control", value: PAGE_CACHE }] })),
    ];
  },
};

export default nextConfig;
