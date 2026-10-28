import type { Metadata } from "next";
import Link from "next/link";
import { InquiryForm } from "@/components/InquiryForm";
import { LAB } from "@/content/lab";
import { SITE } from "@/content/site";

// The root layout points canonical and the share URL at "/"; this page must say "/lab".
export const metadata: Metadata = {
  title: LAB.name,
  description: LAB.description,
  alternates: { canonical: LAB.path },
  openGraph: {
    type: "website",
    url: LAB.path,
    siteName: SITE.name,
    title: `${LAB.name} — ${SITE.name}`,
    description: LAB.description,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: `${LAB.name} — ${SITE.name}`, description: LAB.description },
};

export default function Lab() {
  return (
    <main className="page">
      <div className="topline">
        <Link href="/" className="wordmark">
          {SITE.name}
        </Link>
        <span className="eyebrow">{LAB.status}</span>
      </div>

      <section className="lab-hero">
        <h1 className="display">{LAB.name}</h1>
        <p className="lede">{LAB.lede}</p>
      </section>

      {LAB.sections.map(({ id, title, paragraphs }) => (
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

      <section aria-labelledby="inquiry" className="block">
        <h2 id="inquiry" className="eyebrow">
          {LAB.inquiry.title}
        </h2>
        <p className="statement">{LAB.inquiry.statement}</p>
        <div className="inquiry-unit">
          <InquiryForm />
          <p className="proof">{LAB.inquiry.proof}</p>
        </div>
      </section>

      <footer className="footer">
        {SITE.social.map(({ label, handle, href }) => (
          <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="social">
            <span className="eyebrow">{label}</span>
            <span>{handle} →</span>
          </a>
        ))}
        <Link href="/" className="social">
          <span className="eyebrow">{SITE.name}</span>
          <span>{LAB.backLink} →</span>
        </Link>
      </footer>
    </main>
  );
}
