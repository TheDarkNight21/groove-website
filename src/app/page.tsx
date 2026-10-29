import Link from "next/link";
import { Hero } from "@/components/Hero";
import { PACK_PRICE_CENTS, TERMS } from "@/components/PreorderCta";
import { LAB } from "@/content/lab";
import { PREORDER } from "@/content/preorder";
import { AUDIENCE, INGREDIENTS, SITE, WHY } from "@/content/site";
import { parseCheckoutUrl } from "@/lib/preorder";

// The pull quote is the founders' line from WHY[0], set on its own.
const PULL_QUOTE = "We learned that the hard way, with our own teeth.";

// Tells search engines who the site belongs to and where else the brand lives.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE.name,
  url: SITE.url,
  logo: new URL("/icon-512.png", SITE.url).href,
  description: SITE.description,
  sameAs: SITE.social.map(({ href }) => href),
};

// The checkout is a Stripe Payment Link, public by design. Read once at build time;
// a missing or foreign link fails the build rather than shipping a dead button.
function checkoutUrl() {
  const parsed = parseCheckoutUrl(process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK);
  if (parsed.ok) return parsed.value;
  throw new Error(
    parsed.error === "missing"
      ? "NEXT_PUBLIC_STRIPE_PAYMENT_LINK is not set; the pre-order button has nowhere to go."
      : "NEXT_PUBLIC_STRIPE_PAYMENT_LINK must be an https://buy.stripe.com/… link.",
  );
}

const CHECKOUT_URL = checkoutUrl();

// What's for sale, for search engines: the pack, its price, and that it's a pre-order.
const PRODUCT_DATA = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: PREORDER.name,
  description: TERMS,
  brand: { "@type": "Brand", name: SITE.name },
  url: SITE.url,
  offers: {
    "@type": "Offer",
    url: CHECKOUT_URL,
    priceCurrency: "USD",
    price: (PACK_PRICE_CENTS / 100).toFixed(2),
    availability: "https://schema.org/PreOrder",
    itemCondition: "https://schema.org/NewCondition",
    shippingDetails: { "@type": "OfferShippingDetails", shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" } },
  },
};

const jsonLd = (data: object) => JSON.stringify(data).replace(/</g, "\\u003c");

export default function Home() {
  return (
    <main className="page">
      {/* JSON can't close the script tag once "<" is escaped. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(STRUCTURED_DATA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(PRODUCT_DATA) }} />
      <div className="topline">
        <span className="wordmark">{SITE.name}</span>
        <span className="eyebrow">{SITE.status}</span>
      </div>

      <Hero checkoutUrl={CHECKOUT_URL} />

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

      <section aria-labelledby="lab" className="block">
        <h2 id="lab" className="eyebrow">
          {LAB.name}
        </h2>
        <p className="statement">{LAB.teaser.statement}</p>
        <div className="prose">
          <p>{LAB.teaser.body}</p>
        </div>
        <Link href={LAB.path} className="lab-link">
          {LAB.teaser.link} →
        </Link>
      </section>

      <footer className="footer">
        {SITE.social.map(({ label, handle, href }) => (
          <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="social">
            <span className="eyebrow">{label}</span>
            <span>{handle} →</span>
          </a>
        ))}
        <Link href={LAB.path} className="social">
          <span className="eyebrow">For brands</span>
          <span>{LAB.name} →</span>
        </Link>
      </footer>
    </main>
  );
}
