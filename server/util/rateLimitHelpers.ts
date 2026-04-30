import { RateLimiterMemory } from "rate-limiter-flexible";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";

/* ── Env parsing ─────────────────────────────────────────────── */

function parseRateLimitEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  const parsed = parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid rate limit env var ${name}="${raw}": must be a positive integer`);
  }
  return parsed;
}

const RL_FLOOD_LIMIT = parseRateLimitEnv("RL_FLOOD_LIMIT", 2000);
const RL_NO_COOKIE_LIMIT = parseRateLimitEnv("RL_NO_COOKIE_LIMIT", 100);
const RL_COOKIE_UNAUTH_LIMIT = parseRateLimitEnv("RL_COOKIE_UNAUTH_LIMIT", 300);
const RL_COOKIE_AUTH_LIMIT = parseRateLimitEnv("RL_COOKIE_AUTH_LIMIT", 500);
const RL_WINDOW_SEC = parseRateLimitEnv("RL_WINDOW_SEC", 60);

/* ── Cookie config ───────────────────────────────────────────── */

const APP_ENV = process.env.APP_ENV ?? "production";
const COOKIE_PREFIX = APP_ENV === "production" ? "conductor" : `conductor_${APP_ENV}`;
const RL_COOKIE_NAME = `${COOKIE_PREFIX}_rl`;
const RL_COOKIE_SECRET = process.env.RATE_LIMIT_COOKIE_SECRET || process.env.SECRETKEY || "";
const JWT_COOKIE_DOMAIN = (process.env.PRODUCTIONURLS || "").split(",")[0]?.trim();
const RL_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/* ── IP helpers ──────────────────────────────────────────────── */

function normalizeIp(ip: string): string {
  return ip.replace(/^::ffff:/, "");
}

export function getClientIp(req: Request): string {
  const raw = (req.ips.length > 0 ? req.ips[0] : req.ip) ?? "unknown";
  return normalizeIp(raw);
}

/* ── HMAC cookie signing ─────────────────────────────────────── */

function signCookieValue(value: string): string {
  const hmac = createHmac("sha256", RL_COOKIE_SECRET).update(value).digest("hex");
  return `${value}.${hmac}`;
}

function verifyCookieValue(signed: string): string | null {
  const dotIndex = signed.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const value = signed.substring(0, dotIndex);
  const providedHmac = signed.substring(dotIndex + 1);
  const expectedHmac = createHmac("sha256", RL_COOKIE_SECRET).update(value).digest("hex");

  if (providedHmac.length !== expectedHmac.length) return null;

  try {
    const isValid = timingSafeEqual(
      Buffer.from(providedHmac, "hex"),
      Buffer.from(expectedHmac, "hex"),
    );
    return isValid ? value : null;
  } catch {
    return null; // malformed hex
  }
}

function mintRateLimitCookie(): string {
  const value = randomBytes(16).toString("hex");
  return signCookieValue(value);
}

/* ── Rate limiter instances ──────────────────────────────────── */

const floodLimiter = new RateLimiterMemory({
  keyPrefix: "rl_flood",
  points: RL_FLOOD_LIMIT,
  duration: RL_WINDOW_SEC,
});

const noCookieLimiter = new RateLimiterMemory({
  keyPrefix: "rl_nocookie",
  points: RL_NO_COOKIE_LIMIT,
  duration: RL_WINDOW_SEC,
});

const cookieUnauthLimiter = new RateLimiterMemory({
  keyPrefix: "rl_cookie_unauth",
  points: RL_COOKIE_UNAUTH_LIMIT,
  duration: RL_WINDOW_SEC,
});

const cookieAuthLimiter = new RateLimiterMemory({
  keyPrefix: "rl_cookie_auth",
  points: RL_COOKIE_AUTH_LIMIT,
  duration: RL_WINDOW_SEC,
});

/* ── Header helpers ──────────────────────────────────────────── */

function setRateLimitHeaders(res: Response, rlRes: { remainingPoints: number; msBeforeNext: number }, limit: number) {
  res.set("RateLimit-Limit", String(limit));
  res.set("RateLimit-Remaining", String(rlRes.remainingPoints));
  res.set("RateLimit-Reset", String(Math.ceil(rlRes.msBeforeNext / 1000)));
}

/* ── Middleware: IP-based flood shield (pre-auth) ────────────── */

export async function floodShield(req: Request, res: Response, next: NextFunction) {
  try {
    await floodLimiter.consume(getClientIp(req));
    next();
  } catch {
    res.status(429).json({ err: true, errMsg: "Too many requests" });
  }
}

/* ── Middleware: Cookie-based rate limiter (post-auth) ────────── */

export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const rawCookie: string | undefined = req.cookies?.[RL_COOKIE_NAME];
  const cookieValue = rawCookie ? verifyCookieValue(rawCookie) : null;
  const uuid: string | undefined = (req as any).user?.decoded?.uuid;

  let limiter: RateLimiterMemory;
  let key: string;
  let limit: number;

  if (!cookieValue) {
    // Tier 1: No valid cookie — IP-keyed, lowest limit, mint a cookie
    limiter = noCookieLimiter;
    key = getClientIp(req);
    limit = RL_NO_COOKIE_LIMIT;

    const newCookie = mintRateLimitCookie();
    res.cookie(RL_COOKIE_NAME, newCookie, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: RL_COOKIE_MAX_AGE_MS,
      ...(process.env.NODE_ENV === "production" && {
        secure: true,
        domain: JWT_COOKIE_DOMAIN,
      }),
    });
  } else if (!uuid) {
    // Tier 2: Valid cookie, unauthenticated
    limiter = cookieUnauthLimiter;
    key = cookieValue;
    limit = RL_COOKIE_UNAUTH_LIMIT;
  } else {
    // Tier 3: Valid cookie, authenticated — key off UUID alone so
    // deleting the cookie can't reset the bucket
    limiter = cookieAuthLimiter;
    key = uuid;
    limit = RL_COOKIE_AUTH_LIMIT;
  }

  try {
    const rlRes = await limiter.consume(key, 1);
    setRateLimitHeaders(res, rlRes, limit);
    next();
  } catch (rlRes: any) {
    setRateLimitHeaders(res, rlRes, limit);
    const retryAfter = Math.ceil(rlRes.msBeforeNext / 1000);
    res.set("Retry-After", String(retryAfter));
    res.status(429).json({ err: true, errMsg: "Too many requests. Please try again later." });
  }
}
