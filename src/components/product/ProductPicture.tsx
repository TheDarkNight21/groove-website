import type { ProductImage } from "@/content/catalog";

// One product photo, webp first with the jpeg behind it. Images are served
// unoptimized (next.config), so a plain <picture> offers both formats.
export function ProductPicture({
  image,
  className,
  eager,
}: {
  image: ProductImage;
  className?: string;
  eager?: boolean;
}) {
  return (
    <picture className={className}>
      <source srcSet={image.webp} type="image/webp" />
      <img
        src={image.jpg}
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
