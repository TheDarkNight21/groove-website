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

// A photo of the product on the grey studio stage (Blender Cycles). The can photos are
// the same shoot as the can section's anchors (scripts/render-anchors.mts and
// PRODUCT_SHOTS on the scroll-hero branch); the pack photo is groove-pack's `pack` shot
// (src/render/shots.ts, box-renders e04b58a). Each 4:5 source render is committed in assets/products/ and
// `npm run stage-photos` scales and encodes it into public/products/<name>.webp/.jpg.
export type StagePhoto = {
  readonly name: string;
  // The render it is made from, in assets/products/.
  readonly source: string;
  readonly webp: string;
  readonly jpg: string;
  readonly alt: string;
  // One line under the photo in the gallery, in the site's voice.
  readonly caption: string;
  readonly width: number;
  readonly height: number;
};

// Every stage photo is this size (4:5), so the gallery never changes height.
export const STAGE_PHOTO_SIZE = { width: 1600, height: 2000 } as const;

const stagePhoto = (name: string, source: string, alt: string, caption: string): StagePhoto => ({
  name,
  source,
  webp: `/products/${name}.webp`,
  jpg: `/products/${name}.jpg`,
  alt,
  caption,
  ...STAGE_PHOTO_SIZE,
});

// The 12-pack's box at three-quarter with a can standing beside it: what a pre-order buys.
const MIAMI_PACK = stagePhoto(
  "miami-pack-stage",
  "pack.png",
  "The Miami Groove 12-pack: a white box with a black record on its side, and a white can beside it with MIAMI round the top and a peach tab.",
  "Twelve cans to a box.",
);

const MIAMI_CAN = stagePhoto(
  "miami-can-stage",
  "can.png",
  "The Miami Groove can: matte white, with a black record and a peach label. Peach pineapple sparkling energy drink.",
  "The Miami Groove. Peach pineapple.",
);

export type Product = {
  readonly sku: string;
  readonly name: string;
  // What it tastes like, as printed under the name.
  readonly flavor: string;
  readonly lookupKey: string;
  readonly weightOz: number;
  readonly image: ProductImage;
  // The one photo on the homepage, under the hero, beside the pre-order button: the
  // 12-pack, box and can (2026-11-10). The line beside it says what's in the box.
  readonly showcase: StagePhoto;
  // The photos on /preorder, in order: the pack (the homepage's photo), then the can
  // whole, closer, closest. The box joined on 2026-11-10.
  readonly gallery: readonly [StagePhoto, ...StagePhoto[]];
  // The flavor's color: the orange of the record's label as it reads in the stage
  // photos beside it (#B26C41, sampled from can.png; the printed ink is PANTONE 1565 C,
  // #FFA06A on screens, darkened by the studio light). Used once, as the small marker
  // by the flavor name on /preorder; buttons stay black.
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
    showcase: MIAMI_PACK,
    gallery: [
      MIAMI_PACK,
      MIAMI_CAN,
      stagePhoto(
        "miami-record-stage",
        "can-record.png",
        "Close up of the can's record: black grooves with peach rings, and “Energy for the flow state” around the label.",
        "Energy for the flow state.",
      ),
      stagePhoto(
        "miami-line-stage",
        "can-line.png",
        "The back of the can, close: two lines of small black type, “For the ones who lose track of time.”",
        "For the ones who lose track of time.",
      ),
    ],
    accent: "#b26c41",
  },
];

export const productBySku = (catalog: readonly Product[], sku: string): Product | undefined =>
  catalog.find((p) => p.sku === sku);

export const productByLookupKey = (catalog: readonly Product[], key: string): Product | undefined =>
  catalog.find((p) => p.lookupKey === key);
