import Link from "next/link";
import { SITE } from "@/content/site";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="page">
      <div className="topline">
        <Link href="/" className="wordmark">
          {SITE.name}
        </Link>
        <span className="eyebrow">404</span>
      </div>
      <section className="not-found">
        <h1 className="display">Nothing’s playing here.</h1>
        <p className="lede">The page you were looking for doesn’t exist.</p>
        <Link href="/" className="not-found-link">
          Back to the record →
        </Link>
      </section>
    </main>
  );
}
