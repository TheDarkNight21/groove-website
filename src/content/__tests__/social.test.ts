import { describe, expect, it } from "vitest";
import { SITE } from "../site";

const HOST = { TikTok: "www.tiktok.com", Instagram: "www.instagram.com" } as const;

describe("SITE.social", () => {
  it("links each handle to its own profile on the app it names", () => {
    for (const s of SITE.social) {
      const url = new URL(s.href);
      expect(url.protocol, s.handle).toBe("https:");
      expect(url.host, s.handle).toBe(HOST[s.app]);
      const name = s.handle.replace(/^@/, "");
      expect(url.pathname, s.handle).toBe(s.app === "TikTok" ? `/@${name}` : `/${name}`);
    }
  });
  it("is Groove's two accounts, TikTok then Instagram, which post the same content", () => {
    expect(SITE.social.map((s) => `${s.app} ${s.handle}`)).toEqual(["TikTok @groove.drinks", "Instagram @drink.groove"]);
    expect(SITE.follow).toBe("Follow Groove");
  });
  it("lists every account once", () => {
    expect(new Set(SITE.social.map((s) => s.href)).size).toBe(SITE.social.length);
  });
});
