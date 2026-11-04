import { productBySku, type Product } from "@/content/catalog";

// The product /preorder sells: the one named by ?sku=, or the only one there is.
export const preorderProduct = (catalog: readonly Product[], sku: unknown): Product | undefined =>
  typeof sku === "string" ? productBySku(catalog, sku) : catalog.length === 1 ? catalog[0] : undefined;
