"use client";

import type { Stripe } from "@stripe/stripe-js";
import {
  CheckoutElementsProvider,
  ContactDetailsElement,
  ExpressCheckoutElement,
  PaymentElement,
  ShippingAddressElement,
  useCheckoutElements,
  type StripeCheckoutElementsValue,
} from "@stripe/react-stripe-js/checkout";
import { useEffect, useMemo, useReducer, useState, type FormEvent } from "react";
import { PREORDER, PREORDER_PROMISE } from "@/content/preorder";
import { APPEARANCE, FONTS } from "@/lib/checkout/appearance";
import { canStep, stepPacks, type Step } from "@/lib/checkout/quantity";
import { fieldsReady, initialReveal, revealed, revealStep, type Part } from "@/lib/checkout/reveal";
import { stripeFor } from "@/lib/checkout/stripe-loader";
import { orderSummary, packsLabel, payLabel } from "@/lib/checkout/summary";
import type { Result } from "@/lib/email";
import { CheckoutUnavailable } from "./CheckoutUnavailable";

// The on-site checkout: one Checkout Session (ui_mode "elements") behind Stripe's
// own fields. Every amount shown comes from that session, so the button's price is
// the price charged. Anything that keeps it from opening shows the honest
// unavailable state; there is never a form that can't take money.
//
// Speed: Stripe.js and the session are asked for together, and Stripe's fields
// start loading the moment Stripe.js is here, while the session is still being
// made (the provider takes the secret as a promise). Until the whole form is
// ready, an outline of it holds its place; then the real form replaces it at once.

type Ready = { readonly stripe: Stripe; readonly clientSecret: Promise<string> };
type Opening = { readonly kind: "opening" } | { readonly kind: "ready"; readonly value: Ready } | { readonly kind: "unavailable" };

// How long a ready form waits for Apple Pay / Google Pay before showing without it.
const EXPRESS_GRACE_MS = 600;

// The edge: ask our server for a Checkout Session's client secret.
async function requestSecret(sku: string): Promise<Result<string, string>> {
  try {
    const res = await fetch("/api/checkout/session/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku }),
    });
    if (!res.ok) return { ok: false, error: `session request answered ${res.status}` };
    const body: unknown = await res.json();
    const secret = body && typeof body === "object" && "clientSecret" in body ? body.clientSecret : undefined;
    return typeof secret === "string" && secret !== ""
      ? { ok: true, value: secret }
      : { ok: false, error: "session response had no client secret" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Stripe's provider wants a promise of the secret and reports a rejection as its
// own error state, so the Result becomes a rejection here, at the boundary.
const secretPromise = (sku: string): Promise<string> =>
  requestSecret(sku).then((r) => (r.ok ? r.value : Promise.reject(new Error(r.error))));

export function PreorderCheckout({ publishableKey, sku }: { publishableKey: string; sku: string }) {
  const [opening, setOpening] = useState<Opening>({ kind: "opening" });

  useEffect(() => {
    let current = true;
    // Both requests start now and run together.
    const clientSecret = secretPromise(sku);
    // If Stripe.js fails first, nobody else will ever read this rejection.
    clientSecret.catch(() => {});
    stripeFor(publishableKey).then(
      (stripe) => {
        if (!current) return;
        if (!stripe) console.error("checkout: Stripe.js did not load");
        setOpening(stripe ? { kind: "ready", value: { stripe, clientSecret } } : { kind: "unavailable" });
      },
      (e: unknown) => {
        if (!current) return;
        console.error("checkout: Stripe.js did not load:", e instanceof Error ? e.message : String(e));
        setOpening({ kind: "unavailable" });
      },
    );
    return () => {
      current = false;
    };
  }, [publishableKey, sku]);

  switch (opening.kind) {
    case "opening":
      return <Outline />;
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

// The form's shape while it opens: the same boxes and labels, empty, in the same
// places, so the page reads as a checkout from the first frame and nothing moves
// when Stripe's fields take over. Nothing in it can be typed into or pressed, and
// it shows no amount: amounts come only from the session.
function Outline() {
  return (
    <div className="checkout checkout-outline" aria-hidden="true" inert>
      <div className="checkout-summary">
        <div className="stepper outline-stepper" />
        <dl className="checkout-total">
          <div>
            <dt>Total</dt>
          </div>
        </dl>
      </div>
      <div className="checkout-express" data-wallets="none" />
      <div className="checkout-fields">
        <OutlineField label="Email" />
        <div className="outline-group">
          <OutlineField label="Full name" />
          <OutlineField label="Address" />
        </div>
        <div className="outline-group">
          <OutlineField label="Card number" />
          <div className="outline-row">
            <OutlineField label="Expiration date" />
            <OutlineField label="Security code" />
          </div>
          <p className="outline-note">Billing is same as shipping information</p>
        </div>
      </div>
      <div className="preorder-button outline-pay" />
      <p className="preorder-terms checkout-promise">{PREORDER_PROMISE}</p>
    </div>
  );
}

function OutlineField({ label }: { label: string }) {
  return (
    <div className="outline-field">
      <span className="outline-label">{label}</span>
      <span className="outline-input" />
    </div>
  );
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

// Stripe's fields mount as soon as the provider exists, while the session is still
// loading, so their iframes load alongside it. The outline stays on top until the
// session and every field are ready (see lib/checkout/reveal), then fades out over
// the real form.
function CheckoutForm() {
  const state = useCheckoutElements();
  const [reveal, dispatch] = useReducer(revealStep, initialReveal);
  const [fieldFailed, setFieldFailed] = useState(false);
  const [outlineGone, setOutlineGone] = useState(false);

  const session = state.type === "success";
  useEffect(() => {
    if (session) dispatch({ kind: "session" });
  }, [session]);

  const allFields = fieldsReady(reveal);
  useEffect(() => {
    if (!allFields) return;
    const t = setTimeout(() => dispatch({ kind: "express-grace-over" }), EXPRESS_GRACE_MS);
    return () => clearTimeout(t);
  }, [allFields]);

  if (state.type === "error" || fieldFailed) {
    if (state.type === "error") console.error("checkout:", state.error.message);
    return <CheckoutUnavailable />;
  }

  const shown = revealed(reveal);
  return (
    <div className="checkout-stage" data-revealed={shown} aria-busy={!shown}>
      <Form
        checkout={state.type === "success" ? state.checkout : undefined}
        hidden={!shown}
        onReady={(part) => dispatch({ kind: "ready", part })}
        onFieldFailed={(part, why) => {
          console.error(`checkout: the ${part} field did not load:`, why);
          setFieldFailed(true);
        }}
      />
      {!outlineGone && (
        <div
          className="checkout-stage-outline"
          onTransitionEnd={(e) => {
            if (shown && e.target === e.currentTarget) setOutlineGone(true);
          }}
        >
          <Outline />
        </div>
      )}
    </div>
  );
}

type Busy = "idle" | "quantity" | "paying";

type FormProps = {
  // Undefined while the session loads: the fields are mounting, nothing shows amounts.
  readonly checkout: StripeCheckoutElementsValue | undefined;
  readonly hidden: boolean;
  readonly onReady: (part: Part) => void;
  readonly onFieldFailed: (part: Part, why: string) => void;
};

function Form({ checkout, hidden, onReady, onFieldFailed }: FormProps) {
  const view = checkout ? orderSummary(checkout) : undefined;
  const [busy, setBusy] = useState<Busy>("idle");
  const [quantityError, setQuantityError] = useState<string>();
  const [walletError, setWalletError] = useState<string>();
  const [payError, setPayError] = useState<string>();
  const [wallets, setWallets] = useState(false);

  const step = async (s: Step) => {
    const line = view?.line;
    if (!checkout || !line?.bounds || !canStep(line.packs, s, line.bounds)) return;
    setBusy("quantity");
    setQuantityError(undefined);
    const r = await checkout.updateLineItemQuantity({ lineItem: line.id, quantity: stepPacks(line.packs, s, line.bounds) });
    setBusy("idle");
    if (r.type === "error") setQuantityError(r.error.message || "That quantity didn’t take. Try again.");
  };

  const pay = async (e: FormEvent) => {
    e.preventDefault();
    if (!checkout) return;
    setBusy("paying");
    setPayError(undefined);
    // On success Stripe redirects to the thanks page; only failures come back here.
    const r = await checkout.confirm();
    setBusy("idle");
    if (r.type === "error") setPayError(r.error.message || "The payment didn’t go through. Nothing was charged.");
  };

  const line = view?.line;
  const loadFailed = (part: Part) => (e: { error: { message?: string } }) => onFieldFailed(part, e.error.message ?? "load error");
  return (
    <form className="checkout" onSubmit={pay} noValidate inert={hidden}>
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
          {view?.tax && (
            <div>
              <dt>{view.tax.label}</dt>
              <dd>{view.tax.amount}</dd>
            </div>
          )}
          <div>
            <dt>Total</dt>
            <dd aria-live="polite">{view?.total}</dd>
          </div>
        </dl>
      </div>
      {line?.bounds && quantityError && (
        <p className="checkout-error" role="alert">
          {quantityError}
        </p>
      )}

      <section className="checkout-express" aria-label="Express checkout" data-wallets={wallets ? "some" : "none"}>
        <ExpressCheckoutElement
          options={{
            buttonHeight: 52,
            buttonTheme: { applePay: "black", googlePay: "black" },
            buttonType: { applePay: "order", googlePay: "order" },
            // overflow "never" is only allowed with maxRows 0; Stripe rejected it
            // and Apple Pay / Google Pay never mounted.
            layout: { maxColumns: 1, maxRows: 2, overflow: "auto" },
            paymentMethodOrder: ["apple_pay", "google_pay"],
            paymentMethods: { applePay: "auto", googlePay: "auto", link: "never", paypal: "never", amazonPay: "never", klarna: "never" },
          }}
          onReady={({ availablePaymentMethods }) => {
            setWallets(availablePaymentMethods !== undefined);
            onReady("express");
          }}
          // No wallets is not a failure: the card form still takes the order.
          onLoadError={(e) => {
            console.error("checkout: express checkout did not load:", e.error.message);
            onReady("express");
          }}
          onConfirm={async (event) => {
            if (!checkout) return;
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
        <ContactDetailsElement onReady={() => onReady("contact")} onLoadError={loadFailed("contact")} />
        <ShippingAddressElement onReady={() => onReady("address")} onLoadError={loadFailed("address")} />
        <PaymentElement options={{ layout: "tabs" }} onReady={() => onReady("payment")} onLoadError={loadFailed("payment")} />
      </fieldset>

      <button type="submit" className="preorder-button checkout-pay" disabled={!view || busy !== "idle"}>
        {busy === "paying" ? "Placing pre-order…" : view ? payLabel(PREORDER.button, view.total) : PREORDER.button}
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
