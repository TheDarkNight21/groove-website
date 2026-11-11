import Link from "next/link";
import { PreorderLink } from "@/components/analytics/PreorderLink";
import { SectionWatch } from "@/components/analytics/SectionWatch";
import { WarmStripe } from "@/components/checkout/WarmStripe";
import { Hero } from "@/components/Hero";
import { StagePicture } from "@/components/product/StagePicture";
import { PACK_PRICE_CENTS, TERMS } from "@/components/PreorderCta";
import { CATALOG } from "@/content/catalog";
import { LAB } from "@/content/lab";
import { PRIVACY } from "@/content/privacy";
import { PREORDER } from "@/content/preorder";
import { AUDIENCE, INGREDIENTS, SITE, WHY } from "@/content/site";
import { checkoutConfig } from "@/lib/checkout/config";
import { formatUsd } from "@/lib/preorder";
import { FollowGroove } from "@/components/FollowGroove";

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
    url: SITE.url,
    priceCurrency: "USD",
    price: (PACK_PRICE_CENTS / 100).toFixed(2),
    availability: "https://schema.org/PreOrder",
    itemCondition: "https://schema.org/NewCondition",
    shippingDetails: { "@type": "OfferShippingDetails", shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" } },
  },
};

const jsonLd = (data: object) => JSON.stringify(data).replace(/</g, "\\u003c");

export default function Home() {
  // Warm Stripe for /preorder only when checkout can actually open.
  const checkout = checkoutConfig(process.env);
  return (
    <main className="page">
      {checkout.ok && <WarmStripe publishableKey={checkout.value.publishableKey} />}
      <SectionWatch />
      {/* JSON can't close the script tag once "<" is escaped. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(STRUCTURED_DATA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(PRODUCT_DATA) }} />
      {/* The first screen is the record and the pitch alone: the can waits below the fold. */}
      <div className="first-screen">
        <div className="topline">
          <span className="wordmark">{SITE.name}</span>
          <span className="eyebrow">{SITE.status}</span>
        </div>

        <Hero />
      </div>

      {/* The first scroll answers "what is it?": the 12-pack, box and can. */}
      <section aria-labelledby="the-can" className="showcase">
        <StagePicture photo={CATALOG[0].showcase} className="showcase-shot" />
        <div className="showcase-copy">
          <p className="eyebrow">{CATALOG[0].flavor}</p>
          <h2 id="the-can" className="showcase-name">
            {CATALOG[0].name}
          </h2>
          <p className="showcase-facts">
            {PREORDER.cansPerPack} cans · {formatUsd(PACK_PRICE_CENTS)} · Ships {PREORDER.shipWindow}
          </p>
          <PreorderLink from="the-can" className="preorder-button">
            {PREORDER.button} · {formatUsd(PACK_PRICE_CENTS)}
          </PreorderLink>
        </div>
      </section>

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
        <FollowGroove />
        <Link href={LAB.path} className="social">
          <span className="eyebrow">For brands</span>
          <span>{LAB.name} →</span>
        </Link>
        <Link href={PRIVACY.path} className="social">
          <span className="eyebrow">The fine print</span>
          <span>{PRIVACY.name} →</span>
        </Link>
      </footer>
    </main>
  );
}
