"use client";

import { useState, type FormEvent } from "react";
import { LAB } from "@/content/lab";
import { parseEmail, type Email } from "@/lib/email";
import { errorMessage, MESSAGE_MAX_LENGTH, parseMessage, sendInquiry, type Message } from "@/lib/inquiry";
import { publicConfig } from "@/lib/supabase-rpc";

type State =
  | { readonly phase: "idle" }
  | { readonly phase: "sending" }
  | { readonly phase: "done"; readonly message: string }
  | { readonly phase: "failed"; readonly message: string };

async function submit(email: Email, message: Message): Promise<State> {
  const config = publicConfig();
  if (!config.ok) {
    console.error("inquiry: not configured", config.error);
    return { phase: "failed", message: errorMessage(config.error) };
  }
  const sent = await sendInquiry(config.value, email, message);
  if (!sent.ok) console.error("inquiry: send failed", sent.error);
  return sent.ok
    ? { phase: "done", message: LAB.inquiry.done }
    : { phase: "failed", message: errorMessage(sent.error) };
}

const MESSAGE_ERRORS = {
  empty: "Tell us a little about the drink.",
  "too-long": `Keep it under ${MESSAGE_MAX_LENGTH.toLocaleString("en-US")} characters.`,
} as const;

export function InquiryForm() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState(false);

  // Inline validation, shown once a field has been left or the form submitted, never while first typing.
  const parsedEmail = parseEmail(email);
  const parsedMessage = parseMessage(message);
  const emailError = touched && !parsedEmail.ok ? "That doesn’t look like an email address." : null;
  const messageError = touched && !parsedMessage.ok ? MESSAGE_ERRORS[parsedMessage.error] : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!parsedEmail.ok || !parsedMessage.ok) return;
    setState({ phase: "sending" });
    setState(await submit(parsedEmail.value, parsedMessage.value));
  }

  if (state.phase === "done") {
    return (
      <p role="status" className="waitlist-done">
        {state.message}
      </p>
    );
  }

  const inline = emailError ?? messageError;
  const shown = inline ?? (state.phase === "failed" ? state.message : null);

  return (
    <form onSubmit={onSubmit} noValidate className="inquiry">
      <div className="inquiry-field">
        <label htmlFor="inquiry-email" className="sr-only">
          Email address
        </label>
        <input
          id="inquiry-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@brand.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={emailError !== null}
          aria-describedby={shown ? "inquiry-message" : undefined}
          className="inquiry-input"
        />
        <label htmlFor="inquiry-text" className="sr-only">
          What are you making?
        </label>
        <textarea
          id="inquiry-text"
          name="message"
          rows={5}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder={LAB.inquiry.placeholder}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={messageError !== null}
          aria-describedby={shown ? "inquiry-message" : undefined}
          className="inquiry-textarea"
        />
        <div className="inquiry-actions">
          <button type="submit" disabled={state.phase === "sending"} className="waitlist-button">
            {state.phase === "sending" ? LAB.inquiry.sending : LAB.inquiry.button}
          </button>
        </div>
      </div>
      <p id="inquiry-message" role="alert" className="waitlist-message">
        {shown}
      </p>
    </form>
  );
}
