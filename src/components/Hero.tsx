"use client";

import { useState } from "react";
import { PREORDER } from "@/content/preorder";
import { SITE } from "@/content/site";
import type { CheckoutUrl } from "@/lib/preorder";
import { PreorderCta } from "./PreorderCta";
import { Record } from "./Record";
import { WaitlistForm } from "./WaitlistForm";

type Props = { readonly checkoutUrl: CheckoutUrl };

// Pre-ordering leads. The waitlist stays one tap away for people who aren't ready,
// and joining it is still what spins the record up to 45.
export function Hero({ checkoutUrl }: Props) {
  const [joined, setJoined] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  return (
    <section className="hero">
      <div className="hero-copy">
        <h1 className="display">{SITE.tagline}</h1>
        <p className="lede">{SITE.description}</p>
        <PreorderCta checkoutUrl={checkoutUrl} />
        {waitlistOpen ? (
          <WaitlistForm onJoined={() => setJoined(true)} />
        ) : (
          <button type="button" className="waitlist-link" onClick={() => setWaitlistOpen(true)}>
            {PREORDER.waitlistLink}
          </button>
        )}
      </div>
      <Record joined={joined} />
    </section>
  );
}
