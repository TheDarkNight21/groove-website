import { OPT_PARAM } from "@/lib/analytics/events";

// Everything /privacy says. It describes what the site actually does: when the code in
// src/instrumentation-client.ts or lib/analytics/events.ts changes what is recorded,
// change this page in the same commit.

export const PRIVACY = {
  name: "Privacy",
  path: "/privacy",
  updated: "November 2026",
  lede: "What this site records about your visit, and what it never does.",
  description: "What groovedrinks.com records about a visit, who handles it, and how to turn it off.",

  sections: [
    {
      id: "visits",
      title: "Your visit",
      paragraphs: [
        "We record how the site gets used so we can make it better: which pages you open, how long you stay, how far you scroll, whether you spin the record, and how far you get through checkout. We also keep replays of visits, which show the page as you saw it and where you tapped.",
        "Replays never show what you type. Every field is masked before it leaves your browser, and card details are entered in Stripe’s own fields, which we can’t see at all.",
        "To recognise a returning visitor, the site stores a random id in your browser. It isn’t your name or your email, and we don’t use it to follow you to other sites.",
      ],
    },
    {
      id: "orders",
      title: "Your order",
      paragraphs: [
        "When you pre-order, we keep what it takes to ship it: your name, email, shipping address and what you bought. Payment is handled by Stripe; your card number never reaches us.",
        "We email you about your order. We don’t add you to a mailing list because you bought something.",
      ],
    },
    {
      id: "who",
      title: "Who handles it",
      paragraphs: [
        "A few companies process this for us and for no one else: PostHog (visit analytics and replays), Vercel (hosting and page-view counts), Stripe (payments), Supabase (order records) and Resend (order email).",
        "We don’t sell your information, and we don’t share it with advertisers.",
      ],
    },
  ],

  optOut: {
    id: "off",
    title: "Turn it off",
    statement: "You can stop this browser from being recorded.",
    // Handled by src/instrumentation-client.ts on any page of the site.
    off: { label: "Stop recording my visits", href: `/privacy/?${OPT_PARAM}=off` },
    on: { label: "Turn it back on", href: `/privacy/?${OPT_PARAM}=on` },
  },
} as const;
