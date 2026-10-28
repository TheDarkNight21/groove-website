// Everything the site says about the Lab. Nothing in the system is real yet, so every
// line speaks about what we are building, never what we have: no results, no numbers,
// no present-tense claims. Move a sentence to the present only once it is true.

export const LAB = {
  name: "The Groove Lab",
  path: "/lab",
  status: "In development",
  lede: "An AI research team for beverages, in the making.",
  description: "We’re building an AI research team for beverages. Tell us what you’re making.",

  // The homepage block: the idea in three lines and a door to the page.
  teaser: {
    statement: "We’re building an AI research team for beverages. Groove is its first drink.",
    body:
      "Most drinks are still made the slow way: a formulation house, months of hand-mixing, and a lot of educated guessing. We’re building a system that drafts formulas from a brief, predicts how each will taste and how acidic it will be, and sends only the best few to the lab.",
    link: "Building a drink?",
  },

  sections: [
    {
      id: "problem",
      title: "The problem",
      paragraphs: [
        "Making a new beverage hasn’t changed in decades. A brand pays a formulation house tens of thousands of dollars up front, then waits months while scientists mix, taste and adjust by hand. Most of those rounds are educated guesses.",
        "Groove started because we wanted an energy drink that didn’t erode our teeth. The slow, expensive way drinks get made became the problem we set out to solve.",
      ],
    },
    {
      id: "building",
      title: "What we’re building",
      paragraphs: [
        "An AI research team for beverages. You describe the drink you want: the flavor, the caffeine, the acidity, the ingredients you will and won’t use.",
        "The system will draw on molecular taste data and food-science research to draft candidate formulas, predict how each will taste and how acidic it will be, and narrow them to the few worth making. Only those go to the lab.",
        "Every lab result goes back into the model, so each formula should make the next one faster and more accurate.",
      ],
    },
    {
      id: "goal",
      title: "The goal",
      paragraphs: [
        "Fewer lab rounds, lower upfront cost, and formulas the brand owns. Whether it’s a first drink or a reformulation of one already on shelves, we want the path from idea to a validated formula to be weeks, not months.",
      ],
    },
  ],

  inquiry: {
    title: "Building a drink?",
    statement: "Tell us what you’re making.",
    placeholder: "A sparkling tea with less sugar and no bitterness…",
    button: "Send",
    sending: "Sending…",
    done: "Thanks. We’ll reply by email.",
    proof: "Groove, our low-acid energy drink, will be the first formula to go through it.",
  },

  backLink: "Back to the record",
} as const;
