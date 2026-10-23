"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import {
  TURNTABLE,
  formatRpm,
  grab,
  initialTurntable,
  move,
  pointerAngle,
  release,
  rpmToDegPerSec,
  tick,
  type Turntable,
} from "@/lib/turntable";

// Groove rings between the label and the lead-in, with gaps between "tracks".
const TRACK_GAPS = [52, 66, 80] as const;
const RINGS = Array.from({ length: 42 }, (_, i) => 37 + i * 1.45).filter(
  (r) => TRACK_GAPS.every((g) => Math.abs(r - g) > 1.2),
);
const LABEL_RADIUS = 26;
const LABEL_TEXT = "GROOVE · ENERGY FOR THE FLOW STATE · ";

type Props = { readonly joined: boolean };

export function Record({ joined }: Props) {
  const discRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const state = useRef<Turntable>(initialTurntable);
  const centre = useRef({ x: 0, y: 0 });
  const reduced = useRef(false);
  const target = useRef(0);

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
      const text = formatRpm(state.current.velocity);
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
    e.currentTarget.setPointerCapture(e.pointerId);
    state.current = grab(state.current, angleOf(e), e.timeStamp / 1000);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!state.current.drag) return;
    state.current = move(state.current, angleOf(e), e.timeStamp / 1000);
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
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
          aria-label="A black vinyl record with the Groove label. Drag to spin it."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
            <defs>
              <path id="label-path" d={`M100,100 m-${LABEL_RADIUS},0 a${LABEL_RADIUS},${LABEL_RADIUS} 0 1,1 ${LABEL_RADIUS * 2},0 a${LABEL_RADIUS},${LABEL_RADIUS} 0 1,1 -${LABEL_RADIUS * 2},0`} />
            </defs>
            <circle cx="100" cy="100" r="99" fill="var(--vinyl)" />
            {RINGS.map((r, i) => (
              <circle
                key={r}
                cx="100"
                cy="100"
                r={r}
                fill="none"
                stroke="#fff"
                strokeOpacity={i % 3 === 0 ? 0.09 : 0.045}
                strokeWidth="0.35"
              />
            ))}
            <circle cx="100" cy="100" r="98.2" fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="0.6" />
            <circle cx="100" cy="100" r="34" fill="var(--background)" />
            <text className="record-label-text" fill="var(--foreground)">
              {/* Stretch the text to exactly one lap so the phrase meets itself with no seam */}
              <textPath href="#label-path" textLength={2 * Math.PI * LABEL_RADIUS - 0.5} lengthAdjust="spacing">
                {LABEL_TEXT}
              </textPath>
            </text>
            <text x="100" y="91" textAnchor="middle" className="record-label-name" fill="var(--foreground)">
              groove
            </text>
            <circle cx="100" cy="100" r="2.4" fill="var(--vinyl)" />
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
