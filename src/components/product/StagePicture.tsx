import type { StagePhoto } from "@/content/catalog";

// A product photo on the stage, webp first with the jpeg behind it. Images are served
// unoptimized (next.config), so a plain <picture> offers both formats.
export function StagePicture({ photo, className, eager }: { photo: StagePhoto; className?: string; eager?: boolean }) {
  return (
    <picture className={className}>
      <source srcSet={photo.webp} type="image/webp" />
      <img
        src={photo.jpg}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
      />
    </picture>
  );
}
