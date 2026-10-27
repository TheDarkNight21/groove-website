"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import {
  TURNTABLE,
  currentVelocity,
  formatRpm,
  grab,
  initialTurntable,
  move,
  pointerAngle,
  release,
  rpmToDegPerSec,
  tick,
  touchIntent,
  type Turntable,
} from "@/lib/turntable";
import { RECORD, RINGS, labelPath, labelTextLength } from "@/lib/record-art";

type Props = { readonly joined: boolean };

export function Record({ joined }: Props) {
  const discRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const state = useRef<Turntable>(initialTurntable);
  const centre = useRef({ x: 0, y: 0 });
  const reduced = useRef(false);
  const target = useRef(0);
  // A touch that hasn't yet shown whether it's a spin or a page scroll.
  const pending = useRef<{ x: number; y: number; t: number; angle: number } | null>(null);

  // Motor target follows join state and the reduced-motion preference.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      reduced.current = query.matches;
      target.current = query.matches
        ? 0
        : rpmToDegPerSec(joined ? TURNTABLE.joinedRpm : TURNTABLE.idleRpm);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [joined]);

  // One display-synced loop: step the physics, write transform + readout directly.
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let shown = "";
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      state.current = tick(state.current, dt, target.current);
      if (discRef.current) {
        discRef.current.style.transform = `rotate(${state.current.angle}deg)`;
      }
      const text = formatRpm(currentVelocity(state.current, now / 1000));
      if (text !== shown && readoutRef.current) {
        readoutRef.current.textContent = text;
        shown = text;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const angleOf = (e: PointerEvent) =>
    pointerAngle(centre.current.x, centre.current.y, e.clientX, e.clientY);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    centre.current = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const t = e.timeStamp / 1000;
    if (e.pointerType === "touch") {
      // Phones: wait for the first real movement. Vertical swipes belong to the page
      // (touch-action: pan-y lets the browser scroll); sideways swipes spin the record.
      pending.current = { x: e.clientX, y: e.clientY, t, angle: angleOf(e) };
      return;
    }
    // Mouse and pen: the hand lands on the record and stops it, instantly.
    e.currentTarget.setPointerCapture(e.pointerId);
    state.current = grab(state.current, angleOf(e), t);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const t = e.timeStamp / 1000;
    const touch = pending.current;
    if (touch) {
      const intent = touchIntent(e.clientX - touch.x, e.clientY - touch.y);
      if (intent === "pending") return;
      pending.current = null;
      if (intent === "scroll") return;
      e.currentTarget.setPointerCapture(e.pointerId);
      state.current = grab(state.current, touch.angle, touch.t);
    }
    if (!state.current.drag) return;
    state.current = move(state.current, angleOf(e), t);
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    pending.current = null;
    const released = release(state.current, e.timeStamp / 1000);
    // Reduced motion: the record stays where it was put instead of coasting.
    state.current = reduced.current ? { ...released, velocity: 0 } : released;
  };

  return (
    <figure className="record-unit">
      <div className="record-shell">
        <div
          ref={discRef}
          className="record-disc"
          role="img"
          aria-label="A black vinyl record with the Groove label. Swipe or drag sideways to spin it."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
            <defs>
              <path id="label-path" d={labelPath(RECORD.textRadius)} />
            </defs>
            <circle cx="100" cy="100" r={RECORD.radius} fill="var(--vinyl)" />
            {RINGS.map(({ r, opacity }) => (
              <circle
                key={r}
                cx="100"
                cy="100"
                r={r}
                fill="none"
                stroke="#fff"
                strokeOpacity={opacity}
                strokeWidth="0.35"
              />
            ))}
            <circle cx="100" cy="100" r={RECORD.rimRadius} fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="0.6" />
            <circle cx="100" cy="100" r={RECORD.labelRadius} fill="var(--background)" />
            <text className="record-label-text" fill="var(--foreground)">
              <textPath href="#label-path" textLength={labelTextLength(RECORD.textRadius)} lengthAdjust="spacing">
                {RECORD.labelText}
              </textPath>
            </text>
            <text x="100" y="91" textAnchor="middle" className="record-label-name" fill="var(--foreground)">
              {RECORD.name}
            </text>
            <circle cx="100" cy="100" r={RECORD.spindleRadius} fill="var(--vinyl)" />
          </svg>
        </div>
        {/* Light stays put while the record turns: that's what makes the rotation read. */}
        <div className="record-sheen" aria-hidden />
      </div>
      <figcaption className="record-readout" aria-hidden>
        <span ref={readoutRef} className="tabular-nums">
          33⅓
        </span>
        <span>{joined ? "RPM · You’re in" : "RPM · Give it a spin"}</span>
      </figcaption>
    </figure>
  );
}
