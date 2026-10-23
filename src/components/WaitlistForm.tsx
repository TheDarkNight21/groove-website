"use client";

import { useState, type FormEvent } from "react";

type State =
  | { readonly phase: "idle" }
  | { readonly phase: "sending" }
  | { readonly phase: "done"; readonly message: string }
  | { readonly phase: "failed"; readonly message: string };

async function submit(email: string): Promise<State> {
  try {
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body: { message?: string } = await res.json().catch(() => ({}));
    const message = body.message ?? "Something went wrong. Try again in a moment.";
    return res.ok ? { phase: "done", message } : { phase: "failed", message };
  } catch {
    return { phase: "failed", message: "Couldn’t reach the server. Check your connection." };
  }
}

export function WaitlistForm() {
  const [state, setState] = useState<State>({ phase: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setState({ phase: "sending" });
    setState(await submit(email));
  }

  if (state.phase === "done") {
    return <p role="status" className="border border-foreground px-5 py-4">{state.message}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row" noValidate>
      <label htmlFor="email" className="sr-only">
        Email address
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@email.com"
        className="min-w-0 flex-1 border border-foreground bg-background px-5 py-4 outline-none placeholder:text-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
      />
      <button
        type="submit"
        disabled={state.phase === "sending"}
        className="border border-foreground bg-foreground px-6 py-4 text-background transition-opacity hover:opacity-80 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
      >
        {state.phase === "sending" ? "Joining…" : "Join the waitlist"}
      </button>
      {state.phase === "failed" && (
        <p role="alert" className="text-sm sm:basis-full">
          {state.message}
        </p>
      )}
    </form>
  );
}
