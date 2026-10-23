"use client";

import { useState, type FormEvent } from "react";
import { parseEmail } from "@/lib/email";

type State =
  | { readonly phase: "idle" }
  | { readonly phase: "sending" }
  | { readonly phase: "done"; readonly message: string }
  | { readonly phase: "failed"; readonly message: string };

const FALLBACK = "Something went wrong. Try again in a moment.";

async function submit(email: string): Promise<State> {
  try {
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body: { message?: string } = await res.json().catch(() => ({}));
    const message = body.message ?? FALLBACK;
    return res.ok ? { phase: "done", message } : { phase: "failed", message };
  } catch {
    return { phase: "failed", message: "Couldn’t reach the server. Check your connection." };
  }
}

type Props = { readonly onJoined: () => void };

export function WaitlistForm({ onJoined }: Props) {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);

  // Inline validation, shown once the field has been left, never while typing the first time.
  const parsed = parseEmail(email);
  const inlineError = touched && email !== "" && !parsed.ok ? "That doesn’t look like an email address." : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!parsed.ok) return;
    setState({ phase: "sending" });
    const next = await submit(parsed.value);
    setState(next);
    if (next.phase === "done") onJoined();
  }

  if (state.phase === "done") {
    return (
      <p role="status" className="waitlist-done">
        {state.message}
      </p>
    );
  }

  const message = inlineError ?? (state.phase === "failed" ? state.message : null);

  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      <div className="waitlist-field">
        <label htmlFor="email" className="sr-only">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={message !== null}
          aria-describedby={message ? "email-message" : undefined}
          className="waitlist-input"
        />
        <button type="submit" disabled={state.phase === "sending"} className="waitlist-button">
          {state.phase === "sending" ? "Joining…" : "Join the waitlist"}
        </button>
      </div>
      <p id="email-message" role="alert" className="waitlist-message">
        {message}
      </p>
    </form>
  );
}
