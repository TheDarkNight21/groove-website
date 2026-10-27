import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { SITE } from "@/content/site";
import { BRAND_COLORS } from "@/lib/record-art";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = `${SITE.name} — ${SITE.tagline.replace(/\.$/, "").toLowerCase()}`;

// Icons and the share image come from the file conventions in this folder
// (icon.svg, favicon.ico, apple-icon.png, opengraph-image.png), rendered by scripts/brand-assets.mts.
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: title, template: `%s — ${SITE.name}` },
  description: `${SITE.description} ${SITE.status}`,
  applicationName: SITE.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE.name,
    title,
    description: SITE.description,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title, description: SITE.description },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: BRAND_COLORS.paper,
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
