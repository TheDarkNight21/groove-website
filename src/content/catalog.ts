// What can be bought, one entry per flavor. Each flavor is a city's groove.
// Selling now: Miami. Next, once each recipe is set: Boston (blueberry) and
// Detroit (apple cider); each is one entry here plus `npm run stripe-catalog`.
// The Stripe price for each entry is found
// by its lookup key, which is the same string in test and live mode, so no price id
// lives in the repo or in env. scripts/stripe-catalog.mts creates the prices.
//
// weightOz is the shipped weight of one pack (cans plus box), used for postage.
// PROVISIONAL: 170 oz is a comparable 12 x 12 fl oz energy-drink case (~10.6 lb),
// not a weighed Groove box. Weigh a packed box and replace it before shipping.

// The product shot: a transparent render, served as webp with a png fallback.
// width and height are the files' own pixels, so the page reserves the right space.
export type ProductImage = {
  readonly webp: string;
  readonly png: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
};

// A photo of the product on the grey studio stage (Blender Cycles, the same shoot as
// the can section's anchors on the scroll-hero branch), 4:5, served as webp with a
// jpeg behind it. The source render and its encoder are on the grey-renders branch
// (assets/products/can.png, scripts/product-shots.mts).
export type StagePhoto = {
  readonly webp: string;
  readonly jpg: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
};

export type Product = {
  readonly sku: string;
  readonly name: string;
  // What it tastes like, as printed under the name.
  readonly flavor: string;
  readonly lookupKey: string;
  readonly weightOz: number;
  readonly image: ProductImage;
  // The one photo on the homepage, under the hero: the can on the stage. The line
  // beside it says it comes as a 12-pack.
  readonly showcase: StagePhoto;
  // The flavor's color, sampled from the record rings on its can render. Used once,
  // as the small marker by the flavor name on /preorder; buttons stay black.
  readonly accent: string;
};

export const CATALOG: readonly Product[] = [
  {
    sku: "miami-12pk",
    name: "The Miami Groove",
    flavor: "Peach pineapple",
    lookupKey: "miami-groove-12pk",
    weightOz: 170,
    // Front view of the proposed Miami can (groove-can), rendered for the pre-order.
    image: {
      webp: "/products/miami-can.webp",
      png: "/products/miami-can.png",
      alt: "The Miami Groove can: white, with a black record and a peach label. Peach pineapple sparkling energy drink.",
      width: 900,
      height: 2501,
    },
    showcase: {
      webp: "/products/miami-can-stage.webp",
      jpg: "/products/miami-can-stage.jpg",
      alt: "The Miami Groove can: matte white, with a black record and a peach label. Peach pineapple sparkling energy drink.",
      width: 1600,
      height: 2000,
    },
    accent: "#f6d2ab",
  },
];

export const productBySku = (catalog: readonly Product[], sku: string): Product | undefined =>
  catalog.find((p) => p.sku === sku);

export const productByLookupKey = (catalog: readonly Product[], key: string): Product | undefined =>
  catalog.find((p) => p.lookupKey === key);
