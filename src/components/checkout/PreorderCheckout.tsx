"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  CheckoutElementsProvider,
  ContactDetailsElement,
  ExpressCheckoutElement,
  PaymentElement,
  ShippingAddressElement,
  useCheckoutElements,
  type StripeCheckoutElementsValue,
} from "@stripe/react-stripe-js/checkout";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PREORDER, PREORDER_PROMISE } from "@/content/preorder";
import { APPEARANCE, FONTS } from "@/lib/checkout/appearance";
import { canStep, stepPacks, type Step } from "@/lib/checkout/quantity";
import { orderSummary, packsLabel, payLabel } from "@/lib/checkout/summary";
import type { Result } from "@/lib/email";
import { CheckoutUnavailable } from "./CheckoutUnavailable";

// The on-site checkout: one Checkout Session (ui_mode "elements") behind Stripe's
// own fields. Every amount shown comes from that session, so the button's price is
// the price charged. Anything that keeps it from opening shows the honest
// unavailable state; there is never a form that can't take money.

type Ready = { readonly stripe: Stripe; readonly clientSecret: string };
type Opening = { readonly kind: "opening" } | { readonly kind: "ready"; readonly value: Ready } | { readonly kind: "unavailable" };

// The edge: two independent requests (Stripe.js and a session), so they run together.
async function openSession(publishableKey: string, sku: string): Promise<Result<Ready, string>> {
  try {
    const [stripe, res] = await Promise.all([
      loadStripe(publishableKey),
      fetch("/api/checkout/session/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku }),
      }),
    ]);
    if (!stripe) return { ok: false, error: "Stripe.js did not load" };
    if (!res.ok) return { ok: false, error: `session request answered ${res.status}` };
    const body: unknown = await res.json();
    const secret = body && typeof body === "object" && "clientSecret" in body ? body.clientSecret : undefined;
    return typeof secret === "string" && secret !== ""
      ? { ok: true, value: { stripe, clientSecret: secret } }
      : { ok: false, error: "session response had no client secret" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function PreorderCheckout({ publishableKey, sku }: { publishableKey: string; sku: string }) {
  const [opening, setOpening] = useState<Opening>({ kind: "opening" });

  useEffect(() => {
    let current = true;
    openSession(publishableKey, sku).then((r) => {
      if (!current) return;
      if (!r.ok) console.error("checkout:", r.error);
      setOpening(r.ok ? { kind: "ready", value: r.value } : { kind: "unavailable" });
    });
    return () => {
      current = false;
    };
  }, [publishableKey, sku]);

  switch (opening.kind) {
    case "opening":
      return <Quiet />;
    case "unavailable":
      return <CheckoutUnavailable />;
    case "ready":
      return <Mounted ready={opening.value} />;
    default: {
      const never: never = opening;
      return never;
    }
  }
}

// Space held for the form while it opens, so nothing jumps; no spinner.
function Quiet() {
  return <div className="checkout-quiet" aria-busy="true" aria-label="Opening checkout" />;
}

function Mounted({ ready }: { ready: Ready }) {
  const options = useMemo(
    () => ({ clientSecret: ready.clientSecret, elementsOptions: { appearance: APPEARANCE, fonts: FONTS } }),
    [ready.clientSecret],
  );
  return (
    <CheckoutElementsProvider stripe={ready.stripe} options={options}>
      <CheckoutForm />
    </CheckoutElementsProvider>
  );
}

function CheckoutForm() {
  const state = useCheckoutElements();
  if (state.type === "loading") return <Quiet />;
  if (state.type === "error") {
    console.error("checkout:", state.error.message);
    return <CheckoutUnavailable />;
  }
  return <Form checkout={state.checkout} />;
}

type Busy = "idle" | "quantity" | "paying";

function Form({ checkout }: { checkout: StripeCheckoutElementsValue }) {
  const view = orderSummary(checkout);
  const [busy, setBusy] = useState<Busy>("idle");
  const [quantityError, setQuantityError] = useState<string>();
  const [walletError, setWalletError] = useState<string>();
  const [payError, setPayError] = useState<string>();
  const [wallets, setWallets] = useState(false);

  const step = async (s: Step) => {
    const line = view.line;
    if (!line?.bounds || !canStep(line.packs, s, line.bounds)) return;
    setBusy("quantity");
    setQuantityError(undefined);
    const r = await checkout.updateLineItemQuantity({ lineItem: line.id, quantity: stepPacks(line.packs, s, line.bounds) });
    setBusy("idle");
    if (r.type === "error") setQuantityError(r.error.message || "That quantity didn’t take. Try again.");
  };

  const pay = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("paying");
    setPayError(undefined);
    // On success Stripe redirects to the thanks page; only failures come back here.
    const r = await checkout.confirm();
    setBusy("idle");
    if (r.type === "error") setPayError(r.error.message || "The payment didn’t go through. Nothing was charged.");
  };

  const line = view.line;
  return (
    <form className="checkout" onSubmit={pay} noValidate>
      <div className="checkout-summary">
        {line?.bounds && (
          <div className="stepper" role="group" aria-label="Packs">
            <button
              type="button"
              className="stepper-button"
              aria-label="One pack fewer"
              disabled={busy !== "idle" || !canStep(line.packs, -1, line.bounds)}
              onClick={() => step(-1)}
            >
              −
            </button>
            <output className="stepper-value" aria-live="polite">
              {packsLabel(line.packs, PREORDER.cansPerPack)}
            </output>
            <button
              type="button"
              className="stepper-button"
              aria-label="One pack more"
              disabled={busy !== "idle" || !canStep(line.packs, 1, line.bounds)}
              onClick={() => step(1)}
            >
              +
            </button>
          </div>
        )}
        <dl className="checkout-total">
          {view.tax && (
            <div>
              <dt>{view.tax.label}</dt>
              <dd>{view.tax.amount}</dd>
            </div>
          )}
          <div>
            <dt>Total</dt>
            <dd aria-live="polite">{view.total}</dd>
          </div>
        </dl>
      </div>
      {line?.bounds && quantityError && (
        <p className="checkout-error" role="alert">
          {quantityError}
        </p>
      )}

      <section className="checkout-express" aria-label="Express checkout">
        <ExpressCheckoutElement
          options={{
            buttonHeight: 52,
            buttonTheme: { applePay: "black", googlePay: "black" },
            buttonType: { applePay: "order", googlePay: "order" },
            layout: { maxColumns: 1, maxRows: 2, overflow: "never" },
            paymentMethodOrder: ["apple_pay", "google_pay"],
            paymentMethods: { applePay: "auto", googlePay: "auto", link: "never", paypal: "never", amazonPay: "never", klarna: "never" },
          }}
          onReady={({ availablePaymentMethods }) => setWallets(availablePaymentMethods !== undefined)}
          onConfirm={async (event) => {
            setWalletError(undefined);
            const r = await checkout.confirm({ expressCheckoutConfirmEvent: event });
            if (r.type === "error") setWalletError(r.error.message || "The payment didn’t go through. Nothing was charged.");
          }}
        />
        {walletError && (
          <p className="checkout-error" role="alert">
            {walletError}
          </p>
        )}
        {wallets && <p className="checkout-or">Or pay with card</p>}
      </section>

      <fieldset className="checkout-fields" disabled={busy === "paying"}>
        <ContactDetailsElement />
        <ShippingAddressElement />
        <PaymentElement options={{ layout: "tabs" }} />
      </fieldset>

      <button type="submit" className="preorder-button checkout-pay" disabled={busy !== "idle"}>
        {busy === "paying" ? "Placing pre-order…" : payLabel(PREORDER.button, view.total)}
      </button>
      {payError && (
        <p className="checkout-error" role="alert">
          {payError}
        </p>
      )}
      <p className="preorder-terms checkout-promise">{PREORDER_PROMISE}</p>
    </form>
  );
}
