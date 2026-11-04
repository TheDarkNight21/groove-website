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

// A product photo on the peach stage, rendered by scripts/product-shots.mts from the
// can and carton renders in assets/products/. Served as webp with a jpeg fallback;
// width and height are the files' own pixels, so the page reserves the right space.
export type ProductImage = {
  readonly webp: string;
  readonly jpg: string;
  readonly alt: string;
  // One line under the photo, in the site's voice.
  readonly caption: string;
  readonly width: number;
  readonly height: number;
};

// Every shot is this size (4:5), so the gallery never changes height between photos.
export const SHOT_SIZE = { width: 1600, height: 2000 } as const;

// The stage the photos stand on: a wash of the Miami peach, lit from above. The page
// paints the same colors behind the photos (--stage-* in globals.css).
export const STAGE = { light: "#fcf6ef", base: "#f8ecdf", floor: "#f1dcc6" } as const;

const shot = (name: string, alt: string, caption: string): ProductImage => ({
  webp: `/products/${name}.webp`,
  jpg: `/products/${name}.jpg`,
  alt,
  caption,
  ...SHOT_SIZE,
});

export type Product = {
  readonly sku: string;
  readonly name: string;
  // What it tastes like, as printed under the name.
  readonly flavor: string;
  readonly lookupKey: string;
  readonly weightOz: number;
  // The first is the hero: the carton with a can, as it arrives.
  readonly images: readonly [ProductImage, ...ProductImage[]];
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
    images: [
      shot(
        "miami-pack",
        "The Miami Groove 12-pack: a white carton printed with a peach record and the groove wordmark, with a can standing in front of it.",
        "The box. Twelve cans, one record.",
      ),
      shot(
        "miami-can",
        "The Miami Groove can: white, with a black record and a peach label. Peach pineapple sparkling energy drink.",
        "The Miami Groove. Peach pineapple.",
      ),
      shot(
        "miami-label",
        "Close up of the can's record: black grooves with peach rings, and “Energy for the flow state” around the label.",
        "Energy for the flow state.",
      ),
    ],
    accent: "#f6d2ab",
  },
];

export const productBySku = (catalog: readonly Product[], sku: string): Product | undefined =>
  catalog.find((p) => p.sku === sku);

export const productByLookupKey = (catalog: readonly Product[], key: string): Product | undefined =>
  catalog.find((p) => p.lookupKey === key);
