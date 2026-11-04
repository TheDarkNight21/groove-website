import type { ProductImage } from "@/content/catalog";

// The can render, webp first with the png behind it. Images are served unoptimized
// (next.config), so a plain <picture> offers both formats.
export function CanImage({ image, className, eager }: { image: ProductImage; className?: string; eager?: boolean }) {
  return (
    <picture className={className}>
      <source srcSet={image.webp} type="image/webp" />
      <img
        src={image.png}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
      />
    </picture>
  );
}
