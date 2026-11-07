"use client";

import { useState } from "react";
import { PREORDER } from "@/content/preorder";
import { SITE } from "@/content/site";
import { Record } from "./Record";
import { WaitlistForm } from "./WaitlistForm";

// The hero names the problem and Groove's answer. The page's one pre-order button
// sits with the box just below. The waitlist stays one tap away for people who
// aren't ready, and joining it is still what spins the record up to 45.
export function Hero() {
  const [joined, setJoined] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  return (
    <section className="hero">
      <div className="hero-copy">
        <h1 className="display">{SITE.tagline}</h1>
        <p className="lede">{SITE.pitch}</p>
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
