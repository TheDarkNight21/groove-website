import { Hero } from "@/components/Hero";
import { AUDIENCE, INGREDIENTS, SITE, WHY } from "@/content/site";

// The pull quote is the founders' line from WHY[0], set on its own.
const PULL_QUOTE = "We learned that the hard way, with our own teeth.";

export default function Home() {
  return (
    <main className="page">
      <div className="topline">
        <span className="wordmark">{SITE.name}</span>
        <span className="eyebrow">{SITE.status}</span>
      </div>

      <Hero />

      <section aria-labelledby="why" className="block">
        <h2 id="why" className="eyebrow">
          Why we’re building it
        </h2>
        <blockquote className="pull">{PULL_QUOTE}</blockquote>
        <div className="prose">
          {WHY.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </section>

      <section aria-labelledby="inside" className="block">
        <h2 id="inside" className="eyebrow">
          What goes into it
        </h2>
        <dl className="ingredients">
          {INGREDIENTS.map(({ title, body }) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="people" className="block">
        <h2 id="people" className="eyebrow">
          For people in the groove
        </h2>
        <p className="statement">{AUDIENCE}</p>
      </section>

      <footer className="footer">
        {SITE.social.map(({ label, handle, href }) => (
          <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="social">
            <span className="eyebrow">{label}</span>
            <span>{handle} →</span>
          </a>
        ))}
      </footer>
    </main>
  );
}
