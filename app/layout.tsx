import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Hanken_Grotesk, JetBrains_Mono, Text_Me_One } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });
const shoulders = Big_Shoulders({ variable: "--font-shoulders", subsets: ["latin"], weight: ["700", "800"] });
const textMe = Text_Me_One({ variable: "--font-textme", subsets: ["latin"], weight: "400" });

const TITLE = "DS[Careers] — Space & Defence jobs in Europe";
const DESCRIPTION = "Open roles at space and defence companies, refreshed on every scrape. Europe first, everywhere else one click away.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · DS[Careers]" },
  description: DESCRIPTION,
  applicationName: "DS[Careers]",
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    siteName: "DS[Careers]",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fe" },
    { media: "(prefers-color-scheme: dark)", color: "#050505" },
  ],
};

const themeScript = `try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${hanken.variable} ${jetbrains.variable} ${shoulders.variable} ${textMe.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a href="#main-content" className="skip-link">
          SKIP TO CONTENT
        </a>
        <div className="backdrop-glows" aria-hidden="true" />
        {children}
        <div className="grain" aria-hidden="true" />
      </body>
    </html>
  );
}
