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

// A photo on the homepage, the /preorder gallery or the thanks page. Two kinds share the
// shape: the 12-pack on its studio stage (Blender Cycles, groove-pack's `pack-warm` shot:
// the pack on the warm paper of the studio can photo), and the lifestyle pictures of the
// can (generated images, 2026-11-24, of the Miami can with MIAMI round the top and the
// anodised tab; cropped to 4:5 and nothing else). They picture a can that is not yet
// made, like the renders, so no caption calls one a photograph of the product. Each 4:5
// source is committed in assets/products/ and `npm run stage-photos` scales and encodes
// it into public/products/<name>.webp/.jpg.
export type StagePhoto = {
  readonly name: string;
  // The picture it is made from, in assets/products/.
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

// The can in a hand, against a sunlit wall: its size, and the whole label, at a glance.
const MIAMI_HAND = stagePhoto(
  "miami-hand",
  "lifestyle-hand.png",
  "A hand holding the Miami Groove can against a sunlit cream wall: a white can with MIAMI round the top, a black record with a peach label, and a peach tab.",
  "The Miami Groove. Peach pineapple.",
);

// The 12-pack's box at three-quarter with a can standing beside it: what a pre-order buys.
const MIAMI_PACK = stagePhoto(
  "miami-pack-stage",
  "pack-warm.png",
  "The Miami Groove 12-pack: a white box with a black record on its side, and a white can beside it with MIAMI round the top and a peach tab.",
  "Twelve cans to a box.",
);

export type Product = {
  readonly sku: string;
  readonly name: string;
  // The city the flavor is named for: the one word of the name set in the flavor's color.
  readonly city: string;
  // What it tastes like, as printed under the name.
  readonly flavor: string;
  readonly lookupKey: string;
  readonly weightOz: number;
  readonly image: ProductImage;
  // The one photo on the homepage, under the hero, beside the pre-order button: the can
  // in a hand (2026-11-26; the 12-pack before). The line beside it on the homepage says what's in the box.
  readonly showcase: StagePhoto;
  // The photos on /preorder, in order: the can alone (front on, then from above), the
  // 12-pack a pre-order buys, the can at work and outdoors, and last the line on the back
  // of the can. The homepage's photo is not among them: the buyer has just seen it
  // (Faris, 2026-11-26).
  readonly gallery: readonly [StagePhoto, ...StagePhoto[]];
  // The photo beside the order on the thanks page: one the buyer has not seen yet, so
  // it is never one of the gallery's (2026-11-26). Miami: the can by a pool.
  readonly thanks: StagePhoto;
  // The flavor's color: the ink printed on the can and the box (Miami: PANTONE 1565 C,
  // #FFA06A on screens, the same orange as the record in the Instagram carousels). The
  // stage photos show it darker (#B26C41) because of the studio light; the page uses the
  // ink itself, Faris's choice on 2026-11-18. Used once on a page: the city in the
  // product's name, on the homepage and on /preorder, as MIAMI is the orange word on the
  // can. It is 2:1 on white, so it is only ever set at heading size. Buttons stay black.
  readonly accent: string;
};

// The name split round its city, so the city can take the flavor's color. Undefined when
// the name doesn't contain the city.
export const nameParts = (
  product: Pick<Product, "name" | "city">,
): { readonly before: string; readonly city: string; readonly after: string } | undefined => {
  const at = product.city ? product.name.indexOf(product.city) : -1;
  return at < 0
    ? undefined
    : { before: product.name.slice(0, at), city: product.city, after: product.name.slice(at + product.city.length) };
};

export const CATALOG: readonly Product[] = [
  {
    sku: "miami-12pk",
    name: "The Miami Groove",
    city: "Miami",
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
    showcase: MIAMI_HAND,
    gallery: [
      stagePhoto(
        "miami-studio",
        "lifestyle-studio.png",
        "The Miami Groove can standing on a warm grey studio paper, front on: MIAMI, the record, groove, sparkling energy drink, peach pineapple, 12 fl oz, 120 mg caffeine.",
        "12 fl oz. 120 mg caffeine.",
      ),
      stagePhoto(
        "miami-studio-above",
        "lifestyle-studio-above.png",
        "The Miami Groove can on warm grey studio paper, seen from above and to one side: the peach tab on the lid, MIAMI round the top, and the black record.",
        "A peach tab on top.",
      ),
      MIAMI_PACK,
      stagePhoto(
        "miami-desk",
        "lifestyle-desk.png",
        "The Miami Groove can on a marble counter beside a laptop, with hands typing behind it.",
        "Energy for the flow state.",
      ),
      stagePhoto(
        "miami-tennis",
        "lifestyle-tennis.png",
        "A hand resting the Miami Groove can against a tennis net, the green court behind it in low sun.",
        "Wherever the afternoon goes.",
      ),
      // The line printed on the back of the can, close (a Blender render, like the pack).
      stagePhoto(
        "miami-line-stage",
        "can-line.png",
        "The back of the can, close: two lines of small black type, “For the ones who lose track of time.”",
        "For the ones who lose track of time.",
      ),
    ],
    thanks: stagePhoto(
      "miami-pool",
      "lifestyle-pool.png",
      "The Miami Groove can standing on the pale stone edge of a swimming pool, bright blue water behind it in full sun.",
      "Order received.",
    ),
    accent: "#ffa06a",
  },
];

// Every stage photo a product uses, on any page: what gets encoded and checked.
export const stagePhotosOf = (p: Product): readonly StagePhoto[] => [p.showcase, ...p.gallery, p.thanks];

export const productBySku = (catalog: readonly Product[], sku: string): Product | undefined =>
  catalog.find((p) => p.sku === sku);

export const productByLookupKey = (catalog: readonly Product[], key: string): Product | undefined =>
  catalog.find((p) => p.lookupKey === key);
