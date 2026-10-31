import { createHmac, timingSafeEqual } from "node:crypto";

// One shared secret, ADMIN_TOKEN. Signing in stores HMAC(token, purpose) in an
// httpOnly cookie, never the token itself; rotating the token signs everyone out.
export const ADMIN_COOKIE = "groove_admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const PURPOSE = "groove-admin-session-v1";

// Below this the token is guessable; refuse to run the admin with it.
export const MIN_TOKEN_LENGTH = 24;

export const sessionValue = (adminToken: string): string =>
  createHmac("sha256", adminToken).update(PURPOSE).digest("hex");

const safeEqual = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export const tokenMatches = (adminToken: string, submitted: string): boolean =>
  adminToken.length >= MIN_TOKEN_LENGTH && safeEqual(adminToken, submitted);

export const isAdminSession = (adminToken: string | undefined, cookie: string | undefined): boolean =>
  !!adminToken && adminToken.length >= MIN_TOKEN_LENGTH && !!cookie && safeEqual(sessionValue(adminToken), cookie);
