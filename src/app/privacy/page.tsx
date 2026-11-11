import type { Metadata } from "next";
import Link from "next/link";
import { PRIVACY } from "@/content/privacy";
import { SITE } from "@/content/site";

// The root layout points canonical at "/"; this page must say "/privacy".
export const metadata: Metadata = {
  title: PRIVACY.name,
  description: PRIVACY.description,
  alternates: { canonical: PRIVACY.path },
};

export default function Privacy() {
  const { optOut } = PRIVACY;
  return (
    <main className="page">
      <div className="topline">
        <Link href="/" className="wordmark">
          {SITE.name}
        </Link>
        <span className="eyebrow">Updated {PRIVACY.updated}</span>
      </div>

      <section className="lab-hero">
        <h1 className="display">{PRIVACY.name}</h1>
        <p className="lede">{PRIVACY.lede}</p>
      </section>

      {PRIVACY.sections.map(({ id, title, paragraphs }) => (
        <section key={id} aria-labelledby={id} className="block">
          <h2 id={id} className="eyebrow">
            {title}
          </h2>
          <div className="prose">
            {paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </section>
      ))}

      <section aria-labelledby={optOut.id} className="block">
        <h2 id={optOut.id} className="eyebrow">
          {optOut.title}
        </h2>
        <p className="statement">{optOut.statement}</p>
        {/* Plain links, so they work as full page loads: the choice is read when the page starts. */}
        <a href={optOut.off.href} className="lab-link">
          {optOut.off.label} →
        </a>
        <a href={optOut.on.href} className="lab-link">
          {optOut.on.label} →
        </a>
      </section>
    </main>
  );
}
