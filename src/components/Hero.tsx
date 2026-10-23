"use client";

import { useState } from "react";
import { SITE } from "@/content/site";
import { Record } from "./Record";
import { WaitlistForm } from "./WaitlistForm";

// The record and the form are one unit: joining is what spins the record up to 45.
export function Hero() {
  const [joined, setJoined] = useState(false);

  return (
    <section className="hero">
      <div className="hero-copy">
        <h1 className="display">{SITE.tagline}</h1>
        <p className="lede">{SITE.description}</p>
        <WaitlistForm onJoined={() => setJoined(true)} />
      </div>
      <Record joined={joined} />
    </section>
  );
}
