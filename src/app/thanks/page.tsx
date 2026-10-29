import type { Metadata } from "next";
import Link from "next/link";
import { PREORDER } from "@/content/preorder";
import { SITE } from "@/content/site";

const { thanks } = PREORDER;

// Stripe sends buyers here after checkout. Not for search engines, and it has to
// override the root canonical/OG url or it would claim to be the homepage.
export const metadata: Metadata = {
  title: "Thanks",
  description: thanks.lede,
  robots: { index: false, follow: false },
  alternates: { canonical: thanks.path },
  openGraph: { url: thanks.path, title: `Thanks — ${SITE.name}`, description: thanks.lede },
};

export default function Thanks() {
  return (
    <main className="page">
      <div className="topline">
        <Link href="/" className="wordmark">
          {SITE.name}
        </Link>
        <span className="eyebrow">{thanks.eyebrow}</span>
      </div>
      <section className="not-found">
        <h1 className="display">{thanks.title}</h1>
        <p className="lede">{thanks.lede}</p>
        <Link href="/" className="not-found-link">
          {thanks.back} →
        </Link>
      </section>
    </main>
  );
}
