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
  it("leads with the TikTok, the account /thanks asks buyers to follow", () => {
    expect(SITE.social[0].app).toBe("TikTok");
    expect(SITE.social[0].handle).toBe("@groove.drinks");
    expect(SITE.social.map((s) => s.handle)).toContain("@drink.groove");
  });
  it("lists every account once", () => {
    expect(new Set(SITE.social.map((s) => s.href)).size).toBe(SITE.social.length);
  });
});
