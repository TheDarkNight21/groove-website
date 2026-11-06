import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { CHECKOUT_ORIGINS, STRIPE_JS_URL } from "../origins";

// stripe-js keeps its script URL private, so read it from the installed build.
const require = createRequire(import.meta.url);
const pure = readFileSync(require.resolve("@stripe/stripe-js/dist/pure.js"), "utf8");
const constant = (name: string) => new RegExp(`var ${name} = '([^']+)'`).exec(pure)?.[1];

describe("checkout origins", () => {
  it("preloads the same stripe.js URL that stripe-js injects", () => {
    expect(STRIPE_JS_URL).toBe(`${constant("ORIGIN")}/${constant("RELEASE_TRAIN")}/stripe.js`);
  });

  it("preconnects to the origin stripe.js comes from", () => {
    expect(CHECKOUT_ORIGINS.map((o) => o.href)).toContain(new URL(STRIPE_JS_URL).origin);
  });
});
