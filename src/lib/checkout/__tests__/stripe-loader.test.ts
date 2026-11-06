import { beforeEach, describe, expect, it, vi } from "vitest";

// loadStripe is the network edge; replace it with a counter that can be told to fail.
const loadStripe = vi.fn<(key: string) => Promise<unknown>>();
vi.mock("@stripe/stripe-js/pure", () => ({ loadStripe: (key: string) => loadStripe(key) }));

const fresh = async () => {
  vi.resetModules();
  return (await import("../stripe-loader")).stripeFor;
};

describe("stripeFor", () => {
  beforeEach(() => loadStripe.mockReset());

  it("loads Stripe.js once per key, however many callers ask", async () => {
    loadStripe.mockImplementation(async (key) => ({ key }));
    const stripeFor = await fresh();
    const [a, b] = await Promise.all([stripeFor("pk_test_a"), stripeFor("pk_test_a")]);
    expect(a).toBe(b);
    await stripeFor("pk_test_b");
    expect(loadStripe.mock.calls.map(([k]) => k)).toEqual(["pk_test_a", "pk_test_b"]);
  });

  it("forgets a failed load, so the next caller tries again", async () => {
    loadStripe.mockRejectedValueOnce(new Error("Failed to load Stripe.js")).mockResolvedValueOnce({ ok: true });
    const stripeFor = await fresh();
    await expect(stripeFor("pk_test_a")).rejects.toThrow("Failed to load Stripe.js");
    await expect(stripeFor("pk_test_a")).resolves.toEqual({ ok: true });
    expect(loadStripe).toHaveBeenCalledTimes(2);
  });
});
