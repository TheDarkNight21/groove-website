import { nameParts, type Product } from "@/content/catalog";

// The product's name with its city in the flavor's color, as on the can: MIAMI is the
// orange word there, the rest is black. A name without its city is set plain.
export function FlavorName({ product }: { product: Product }) {
  const parts = nameParts(product);
  if (!parts) return <>{product.name}</>;
  return (
    <>
      {parts.before}
      <span style={{ color: product.accent }}>{parts.city}</span>
      {parts.after}
    </>
  );
}
