import type { Appearance, CssFontSource } from "@stripe/stripe-js";

// Stripe's fields live in iframes and can't see our CSS, so the site's tokens are
// restated here once. appearance.test.ts reads globals.css and fails if they drift.
// Black on white; the only color is red, and only for an error.

export const TOKENS = {
  background: "#ffffff", // --background
  foreground: "#000000", // --foreground
  muted: "rgba(0, 0, 0, 0.55)", // --muted
  hairline: "rgba(0, 0, 0, 0.12)", // --hairline
  // The site's field radius (.inquiry-field); pills are for single buttons.
  radius: "1.5rem",
  focusRing: "0 0 0 4px rgba(0, 0, 0, 0.08)", // .waitlist-field:focus-within
  danger: "#c8102e", // --danger
} as const;

// The same face as next/font's Geist Mono on the page, loaded inside Stripe's iframes.
export const FONTS: CssFontSource[] = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&display=swap" }];
const FONT_FAMILY = "'Geist Mono', ui-monospace, monospace";

export const APPEARANCE: Appearance = {
  theme: "flat",
  variables: {
    fontFamily: FONT_FAMILY,
    fontSizeBase: "16px", // 16px keeps iOS from zooming on focus
    colorPrimary: TOKENS.foreground,
    colorBackground: TOKENS.background,
    colorText: TOKENS.foreground,
    colorTextSecondary: TOKENS.muted,
    colorTextPlaceholder: "rgba(0, 0, 0, 0.35)",
    colorDanger: TOKENS.danger,
    borderRadius: TOKENS.radius,
    spacingUnit: "4px",
    gridRowSpacing: "14px",
  },
  rules: {
    ".Input": {
      backgroundColor: TOKENS.background,
      border: `1px solid ${TOKENS.foreground}`,
      boxShadow: "none",
      padding: "13px 18px",
    },
    ".Input:focus": { boxShadow: TOKENS.focusRing, outline: "none" },
    ".Input--invalid": { borderStyle: "dashed", borderColor: TOKENS.danger, boxShadow: "none" },
    ".Label": {
      fontSize: "12px",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: TOKENS.muted,
    },
    ".Error": { fontSize: "13px" },
    ".Tab, .Block, .AccordionItem": { border: `1px solid ${TOKENS.hairline}`, boxShadow: "none" },
    ".Tab--selected, .Tab--selected:focus": { borderColor: TOKENS.foreground, boxShadow: "none" },
  },
};
