// All homepage copy and links live here. Claims are the founders' own words;
// swap in lab numbers (pH, titratable acidity) once testing exists.

export const SITE = {
  name: "groove",
  // The production address. Canonical URLs, share cards and the sitemap all derive from it.
  url: "https://www.groovedrinks.com",
  tagline: "Energy for the flow state.",
  description:
    "Groove is a premium sparkling energy drink for creators and people devoted to their craft.",
  // The hero under the headline: the problem, then Groove. The story and the caffeine live further down.
  pitch:
    "Most energy drinks are far more acidic than coffee, and hard on your teeth. Groove is a sparkling energy drink designed to be gentler on enamel.",
  status: "Pre-orders open.",
  // Where to follow Groove, customers' accounts first (Steve, 2026-11-07): the footer of
  // the homepage and the Lab lists them in this order, each naming its app. The first is
  // also the one line on /thanks. Nothing in the top line or on /preorder: no exits
  // before someone buys.
  social: [
    {
      label: "Follow Groove",
      handle: "@groove.drinks",
      app: "TikTok",
      href: "https://www.tiktok.com/@groove.drinks",
    },
    {
      label: "Get launch news",
      handle: "@drink.groove",
      app: "Instagram",
      href: "https://www.instagram.com/drink.groove",
    },
    {
      label: "Follow the build",
      handle: "@building.groove",
      app: "Instagram",
      href: "https://www.instagram.com/building.groove",
    },
  ],
  // On /thanks, under the refund promise: someone who just paid wants to watch it get made.
  watch: "Watch it get made",
} as const;

export const SHORT_VERSION =
  "Groove is a premium sparkling energy drink for creators and people devoted to their craft. It gives you clean, steady energy that gets you into the work and keeps you there, without the harsh spike or the hard crash.";

export const WHY = [
  "Most energy drinks are among the most acidic things you can drink, far more acidic than coffee. We learned that the hard way, with our own teeth.",
  "Groove is our answer: an energy drink designed from the ground up to be gentler on enamel, closer to coffee than to soda.",
] as const;

export const INGREDIENTS = [
  {
    title: "Smoother energy",
    body: "About 120 mg of caffeine from green coffee beans. That’s enough to feel it, with a gentler comedown.",
  },
  {
    title: "Less acid, by design",
    body: "We’re formulating for lower acidity, so your mouth recovers faster after every sip.",
  },
  {
    title: "Real ingredients",
    body: "Organic cane sugar, stevia leaf, and natural sources wherever we can use them.",
  },
  {
    title: "Backed by research",
    body: "Built with a professional lab and grounded in the dental science on enamel erosion.",
  },
] as const;

export const AUDIENCE =
  "Groove is for the ones who lose track of time.";
