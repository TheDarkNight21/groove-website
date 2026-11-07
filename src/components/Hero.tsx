import { SITE } from "@/content/site";
import { Record } from "./Record";

// The hero names the problem and Groove's answer. The page's one pre-order button
// sits with the box just below. Joining the waitlist is off for now: WaitlistForm,
// its API and the list itself are untouched, so bringing it back is a matter of
// rendering the form here again and passing its joined state to the record.
export function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <h1 className="display">{SITE.tagline}</h1>
        <p className="lede">{SITE.pitch}</p>
      </div>
      <Record joined={false} />
    </section>
  );
}
