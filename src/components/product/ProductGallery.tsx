"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { StagePhoto } from "@/content/catalog";
import { StagePicture } from "./StagePicture";

// The product photos as a carousel, the way Apple's product pages do it: one photo at
// a time, a round arrow on each side to step through, dots below for where you are.
// Phones also swipe; keyboards use the arrow keys. The strip is plain CSS scroll-snap,
// so it still swipes without JavaScript.
export function ProductGallery({ images, name }: { images: readonly StagePhoto[]; name: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // The photo an arrow or a dot is moving to. While it is set, the slide's in-between
  // positions don't count: the caption and dots go straight to it and stay there
  // (reading them mid-slide flashed the old caption, then the one passed on the way).
  const heading = useRef<number | null>(null);

  // The photo nearest the strip's left edge is the one being looked at.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const nearest = () => {
      const slides = Array.from(el.children) as HTMLElement[];
      const distance = (s: HTMLElement) => Math.abs(s.offsetLeft - el.offsetLeft - el.scrollLeft);
      return slides.reduce((best, s, i) => (distance(s) < distance(slides[best]) ? i : best), 0);
    };
    const update = () => {
      frame = 0;
      const now = nearest();
      if (heading.current === null) setActive(now);
      else if (now === heading.current) heading.current = null;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    // Settled: whatever is showing is the truth, even if a swipe cut the slide short.
    const onEnd = () => {
      heading.current = null;
      setActive(nearest());
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", onEnd);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", onEnd);
      cancelAnimationFrame(frame);
    };
  }, []);

  const show = (i: number) => {
    const el = track.current;
    const slide = el?.children[i] as HTMLElement | undefined;
    if (!el || !slide) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Centre the slide in the track, where centre snapping will hold it, so the target
    // and the snap point agree and nothing pulls back after the scroll.
    const left = slide.offsetLeft - el.offsetLeft - (el.clientWidth - slide.clientWidth) / 2;
    heading.current = i;
    setActive(i);
    el.scrollTo({ left, behavior: reduced ? "auto" : "smooth" });
  };
  const last = images.length - 1;
  const step = (by: -1 | 1) => show(Math.min(last, Math.max(0, active + by)));

  const onKey = (e: KeyboardEvent) => {
    const by = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!by) return;
    e.preventDefault();
    step(by);
  };

  return (
    <section className="gallery" aria-roledescription="carousel" aria-label={`${name} photos`} onKeyDown={onKey}>
      <div className="gallery-stage">
        <div ref={track} className="gallery-track" tabIndex={0} aria-label="Photos. Use the arrow keys to move.">
          {images.map((image, i) => (
            <figure
              key={image.webp}
              className="gallery-slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${images.length}`}
            >
              <StagePicture photo={image} eager={i === 0} />
            </figure>
          ))}
        </div>
        {/* At the ends the arrow that leads nowhere fades out and stops taking taps. */}
        <button type="button" className="gallery-arrow gallery-arrow-prev" aria-label="Previous photo" disabled={active === 0} onClick={() => step(-1)}>
          <Chevron flip />
        </button>
        <button type="button" className="gallery-arrow gallery-arrow-next" aria-label="Next photo" disabled={active === last} onClick={() => step(1)}>
          <Chevron />
        </button>
      </div>
      {/* The photo's line sits under the stage, never over the product. */}
      <p className="gallery-caption" aria-live="polite">
        {images[active].caption}
      </p>
      <div className="gallery-dots" role="group" aria-label="Choose a photo">
        {images.map((image, i) => (
          <button
            key={image.webp}
            type="button"
            className="gallery-dot"
            aria-label={`Photo ${i + 1}: ${image.caption}`}
            aria-current={i === active ? "true" : undefined}
            onClick={() => show(i)}
          />
        ))}
      </div>
    </section>
  );
}

function Chevron({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
