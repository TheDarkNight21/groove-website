"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ProductImage } from "@/content/catalog";
import { ProductPicture } from "./ProductPicture";

// The product photos as one swipeable strip on the peach stage. Phones swipe, with
// the next photo peeking in and dots below; tablets get thumbnails under the stage;
// computers get a thumbnail rail beside it, clickable and arrow-key driven. The strip
// is plain CSS scroll-snap, so it still swipes without JavaScript.
export function ProductGallery({ images, name }: { images: readonly ProductImage[]; name: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // The photo nearest the strip's left edge is the one being looked at.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const slides = Array.from(el.children) as HTMLElement[];
      const left = el.scrollLeft;
      let best = 0;
      slides.forEach((s, i) => {
        if (Math.abs(s.offsetLeft - el.offsetLeft - left) < Math.abs(slides[best].offsetLeft - el.offsetLeft - left)) best = i;
      });
      setActive(best);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const show = (i: number) => {
    const el = track.current;
    const slide = el?.children[i] as HTMLElement | undefined;
    if (!el || !slide) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: slide.offsetLeft - el.offsetLeft, behavior: reduced ? "auto" : "smooth" });
    setActive(i);
  };

  const onKey = (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    show(Math.min(images.length - 1, Math.max(0, active + step)));
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
              <ProductPicture image={image} eager={i === 0} />
            </figure>
          ))}
        </div>
      </div>
      {/* The photo's line sits under the stage, never over the product. */}
      <p className="gallery-caption" aria-live="polite">
        {images[active].caption}
      </p>
      <div className="gallery-thumbs" role="group" aria-label="Choose a photo">
        {images.map((image, i) => (
          <button
            key={image.webp}
            type="button"
            className="gallery-thumb"
            aria-label={`Photo ${i + 1}: ${image.caption}`}
            aria-current={i === active ? "true" : undefined}
            onClick={() => show(i)}
          >
            <ProductPicture image={image} />
          </button>
        ))}
      </div>
    </section>
  );
}
