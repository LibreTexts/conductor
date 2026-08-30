//
// LibreTexts Conductor
// server.js
//

if (process.env.NODE_ENV === "production") {
  await import("newrelic");
}

// Must precede ./logger.js — the logger reads NODE_ENV/LOG_LEVEL at module init.
import "dotenv/config";
import logger, { childLogger } from "./logger.js";
import path from "path";
import { exit } from "process";
import { fileURLToPath } from "url";
import fs from "fs";
import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import Promise from "bluebird";
import helmet from "helmet";
import api, { permalinkRouter } from "./api.js";
import { requestContext } from "./request-context.js";
import { httpLogger } from "./http-logger.js";
import { floodShield } from "./util/rateLimitHelpers.js";
import { sitemapRouter } from "./static-endpoints/sitemap.js";
import { startAutoHealReconciler } from "./api/services/store-auto-heal-service.js";
const dbLog = childLogger("db");

// Prevent startup without ORG_ID env variable
if (!process.env.ORG_ID) {
  logger.fatal("The ORG_ID environment variable is missing.");
  logger.flush();
  exit(1);
}

// Validate TRUST_PROXY_HOPS env variable and set default if not provided
const _trustProxyRaw = process.env.TRUST_PROXY_HOPS;
const _trustProxyHops = _trustProxyRaw !== undefined ? parseInt(_trustProxyRaw, 10) : 2; // Default to 2 hops for Cloudflare + ALB, but can be set to 0 to disable if not behind proxies
if (!Number.isInteger(_trustProxyHops) || _trustProxyHops < 0) {
  throw new Error(`Invalid TRUST_PROXY_HOPS="${_trustProxyRaw}": must be a non-negative integer`);
}


const app = express();
const port = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const matomoDomain = process.env.MATOMO_DOMAIN;
const matomoSiteID = process.env.MATOMO_SITE_ID;

mongoose.Promise = Promise;
mongoose.set("debug", process.env.NODE_ENV === "development");

app.set("trust proxy", _trustProxyHops);
app.use(cookieParser());
app.use(helmet.hidePoweredBy());
if (process.env.NODE_ENV === "production") {
  // Staged rollout: start at 300s, then 86400s, then 31536000s (1 year).
  // Only add `preload` after submitting to the HSTS preload list.
  app.use(
    helmet.strictTransportSecurity({
      maxAge: 31536000,
      includeSubDomains: true,
      preload: false,
    })
  );
}
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      baseUri: ["'self'"],
      childSrc: ["'self'", "https://*.libretexts.org"],
      connectSrc: [
        "'self'",
        "https://*.libretexts.org",
        "*.google-analytics.com", // gtag.js
        '*.cloudfront.net',
        '*.videodelivery.net', // Cloudflare Stream
        'https://*.libretexts.net', // LibreTexts CDN
        "https://bam.nr-data.net", // New Relic Browser
      ],
      defaultSrc: ["'self'"],
      fontSrc: [
        "'self'",
        "https://*.libretexts.org",
        "https://fonts.gstatic.com",
        "data:",
      ],
      frameSrc: ["'self'", "https://*.libretexts.org", "https://*.cloudflare.com", "https://www.youtube.com", "https://*.cloudflarestream.com"], // Cloudflare (Turnstile), YouTube, Cloudflare Stream
      imgSrc: ["'self'", "https:", "data:"],
      mediaSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"], // NewRelic session replay
      scriptSrc: [
        "'self'",
        "https://*.libretexts.org",
        "https://*.cloudflare.com", // Cloudflare (Turnstile)
        "https://*.libretexts.net", // LibreTexts CDN
        "'sha256-wjPyHKFbRc4HkIhBXM6I/dBX9NqqdnXFbz8jONRWKCU='", // gtag.js inline
        "'sha256-pnIV3nmqaM9pcomyIJxQz4o3MHOOZiXIQ7B+8Wca1Fw='", // Matomo (traffic.libretexts.org) inline
        "'sha256-aawMBSWTXKcxtf97Ip9Pv5QB2AqhxUOYnYSLtKH0eBo='", // New Relic Browser inline
        "'sha256-N3GwF3F0yVStOHQ4jxCvXyt6XrRYmQ/y5TvgGD8/cd4='", // New Relic Browser inline
        "*.googletagmanager.com", // gtag.js,
        "*.ssa.gov", // ANDI,
        "https://ajax.googleapis.com", // Google CDN (jQuery for ANDI)
        "https://embed.cloudflarestream.com", // Cloudflare Stream
        "https://js-agent.newrelic.com" // New Relic Browser
      ],
      styleSrc: [
        "'self'",
        "https://*.libretexts.org",
        "https://fonts.googleapis.com",
        "*.ssa.gov",
        "'unsafe-inline'", // TODO: Review
      ],
    },
  })
);

// Build identity endpoint. Used by the client to detect that a new release is live
// so it can prompt for a reload instead of failing on a chunk that no longer exists.
app.get("/api/v1/build", (_req, res) => {
  res
    .setHeader("Cache-Control", "no-store")
    .json({
      version: process.env.VERSION ?? "dev",
      ref: process.env.VCS_REF ?? null,
    });
});

// Serve API
// requestContext opens the AsyncLocalStorage scope that gives every log line beneath a
// request its reqId; httpLogger emits the one access line per request. Both are mounted
// here rather than globally so static asset and SPA-fallback traffic stays out of the logs.
app.use("/api/v1", requestContext, httpLogger, floodShield, api);
app.use("/permalink", requestContext, httpLogger, permalinkRouter);

// Health endpoint that checks actual MongoDB connection status
app.use("/health", (_req, res) => {
  const mongoState = mongoose.connection.readyState;
  const stateMap: Record<number, string> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };

  const isHealthy = mongoState === 1;
  const status = isHealthy ? 200 : 503;

  res.status(status).json({
    healthy: isHealthy,
    msg: isHealthy ? "Server appears healthy." : "MongoDB connection not ready",
    mongodb: {
      state: stateMap[mongoState] || "unknown",
      readyState: mongoState
    }
  });
});

// Serve frontend assets. Resolve relative to the server package root (one level up from dist/ in prod, same dir in dev).
const serverRoot = __dirname.endsWith("dist") ? path.join(__dirname, "..") : __dirname;
const clientDist = path.join(serverRoot, "../client/dist");

// Load index.html once. Strip the NewRelic browser monitoring snippet outside production so it doesn't run locally.
const indexHtmlPath = path.resolve(clientDist, "index.html");
let indexHtml = fs.readFileSync(indexHtmlPath, "utf-8");
if (process.env.NODE_ENV !== "production") {
  indexHtml = indexHtml.replace(
    /[ \t]*<!-- NewRelic:start -->[\s\S]*?<!-- NewRelic:end -->\r?\n?/,
    ""
  );
}

// Build identity used to cache-bust the two runtime-generated scripts below. Their contents are
// fixed for the life of a build, so a versioned URL can be cached hard while a new deploy moves
// clients to a new URL via the (uncached) document.
const BUILD_VERSION = process.env.VERSION;

// Point the document at the versioned URLs. Without a VERSION (local dev) the plain paths stay,
// which is what the Vite dev server serves anyway.
if (BUILD_VERSION) {
  const v = encodeURIComponent(BUILD_VERSION);
  indexHtml = indexHtml
    .replace('src="/env.js"', `src="/env.js?v=${v}"`)
    .replace('src="/matomo-init.js"', `src="/matomo-init.js?v=${v}"`);
}

// A request carrying the current build's version can never go stale: the URL changes on the next
// deploy. Anything else (a client on old HTML, a bookmark, a crawler) gets a short TTL so it
// self-heals within minutes instead of pinning a stale copy. `public` so the edge can serve it too.
const setBuildScriptCacheControl = (req: express.Request, res: express.Response) => {
  const versioned = BUILD_VERSION && req.query.v === BUILD_VERSION;
  res.setHeader(
    "Cache-Control",
    versioned ? "public, max-age=31536000, immutable" : "public, max-age=300"
  );
};

// The document must never be cached: it is the only thing that maps a client to the
// current build's hashed chunk filenames. Stale HTML points at chunks that no longer exist.
const sendIndexHtml = (res: express.Response) => {
  res
    .setHeader("Content-Type", "text/html")
    .setHeader("Cache-Control", "no-cache, must-revalidate")
    .send(indexHtml);
};

// Serve index.html from the in-memory copy so the conditional strip takes effect; static middleware handles other assets.
app.get(["/", "/index.html"], (_req, res) => {
  sendIndexHtml(res);
});

app.use(sitemapRouter());

// Vite content-hashes every filename under /assets, so a given URL's bytes never change:
// cache it for a year. This also keeps a previous build's chunks alive at the edge long
// after a deploy, which is what already-open tabs need.
// fallthrough:false is load-bearing — without it a missing chunk falls through to the SPA
// catch-all below and is answered with 200 text/html, which Cloudflare then caches under
// the .js URL and serves to every user until the TTL expires.
app.use(
  "/assets",
  express.static(path.join(clientDist, "assets"), {
    index: false,
    fallthrough: false,
    immutable: true,
    maxAge: "1y",
  })
);

app.use(
  "/assets",
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (err?.status === 404 || err?.statusCode === 404) {
      res
        .status(404)
        .setHeader("Cache-Control", "no-store")
        .type("text/plain")
        .send("Not found");
      return;
    }
    next(err);
  }
);

// Branding assets copied from client/public: favicons, touch icons, logos, manifest. None are
// content-hashed, so they get a bounded TTL rather than `immutable` — the ETag makes the weekly
// revalidation cheap. Without an explicit maxAge, express.static sends `public, max-age=0`, which
// forces a revalidation round trip on every page load AND makes the response uncacheable at the edge.
app.use(express.static(clientDist, { index: false, maxAge: "7d" }));

// Serve runtime env config for frontend use. Loaded via <script src="/env.js"> in index.html to avoid CSP issues with inline scripts.
const appEnv = process.env.APP_ENV ?? "production";
const envJs = `window.__APP_ENV__ = ${JSON.stringify(appEnv)};`;
app.get("/env.js", (req, res) => {
  setBuildScriptCacheControl(req, res);
  res.setHeader("Content-Type", "application/javascript").send(envJs);
});

// Matomo tracking
const matomoJS = matomoDomain && matomoSiteID ? `
  var _paq = window._paq = window._paq || [];
  /* tracker methods like "setCustomDimension" should be called before "trackPageView" */
  _paq.push(["setDocumentTitle", document.domain + "/" + document.title]);
  _paq.push(["setCookieDomain", "*.libretexts.org"]);
  _paq.push(["setDoNotTrack", true]);
  _paq.push(['trackPageView']);
  _paq.push(['enableLinkTracking']);
  (function() {
    var u="//${matomoDomain}/";
    _paq.push(['setTrackerUrl', u+'matomo.php']);
    _paq.push(['setSiteId', '${matomoSiteID}']);
    var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
    g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
  })();
` : '/* Matomo not configured */';
app.get("/matomo-init.js", (req, res) => {
  setBuildScriptCacheControl(req, res);
  res.setHeader("Content-Type", "application/javascript").send(matomoJS);
});

// Extensions of files this server ships. A request for one of these that reaches the SPA
// fallback missed on disk. Kept to a known list rather than "any dot" so app routes whose
// params contain a period still resolve.
const STATIC_FILE_EXT =
  /\.(js|mjs|cjs|css|map|json|webmanifest|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|otf|eot|txt|xml)$/i;

let cliRouter = express.Router();
cliRouter.route("*").get((req, res) => {
  // A static asset request that missed. Answering it with the app shell produces a
  // cacheable 200 of HTML under an asset URL, which poisons the CDN for every other client.
  if (STATIC_FILE_EXT.test(req.path)) {
    res
      .status(404)
      .setHeader("Cache-Control", "no-store")
      .type("text/plain")
      .send("Not found");
    return;
  }
  sendIndexHtml(res);
});
app.use("/", cliRouter);

// Start the server BEFORE MongoDB connection to allow healthchecks to pass immediately
const server = app.listen(port, () => {
  let startupMsg = "";
  if (process.env.ORG_ID === "libretexts") {
    startupMsg = `Conductor is listening on ${port}`;
  } else {
    startupMsg = `Conductor (${process.env.ORG_ID}) is listening on ${port}`;
  }
  logger.info(startupMsg);

  // Initiate MongoDB connection after server is listening
  connectToMongoDB();

  // Recovery attempts for rejected store orders live on the StoreOrder documents, so this can start
  // before Mongo is up: the first tick simply finds nothing, and any attempt left in flight by a
  // restart is picked up as soon as the connection settles.
  startAutoHealReconciler();
});

server.on("error", (err: Error) => {
  logger.error({ err }, "HTTP server error");
});

/* Without these, a crash leaves nothing behind — the process dies before anything is
   written. `flush` is what gets the line out ahead of the exit. */
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — exiting");
  logger.flush();
  exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled promise rejection — exiting");
  logger.flush();
  exit(1);
});

/**
 * Connects to MongoDB with retry logic and error handling
 */
async function connectToMongoDB(retryCount = 0) {
  const maxRetries = 5;
  const retryDelay = 5000; // 5 seconds

  try {
    dbLog.info(`Attempting to connect to MongoDB (attempt ${retryCount + 1}/${maxRetries + 1})...`);

    await mongoose.connect(process.env.MONGOOSEURI ?? "", {
      maxPoolSize: process.env.ORG_ID === "libretexts" ? 100 : 25,
    });

    dbLog.info("✓ Connected to MongoDB Atlas.");
  } catch (err) {
    if (retryCount < maxRetries) {
      // Recoverable: another attempt is already scheduled.
      dbLog.warn(
        { err, attempt: retryCount + 1, maxAttempts: maxRetries + 1, retryInMs: retryDelay },
        "Failed to connect to MongoDB — retrying"
      );
      setTimeout(() => connectToMongoDB(retryCount + 1), retryDelay);
    } else {
      dbLog.fatal(
        { err, attempts: maxRetries + 1 },
        "Unable to connect to MongoDB after maximum retries — check the connection string and network connectivity"
      );
      dbLog.flush();
      // Exit the process if we can't connect to MongoDB after all retries
      exit(1);
    }
  }
}

// Handle MongoDB connection events
mongoose.connection.on("connected", () => {
  dbLog.info("MongoDB connection established");
});

mongoose.connection.on("error", (err) => {
  dbLog.error({ err }, "MongoDB connection error");
});

mongoose.connection.on("disconnected", () => {
  dbLog.warn("MongoDB connection lost. Attempting to reconnect...");
});

/**
 * Performs a graceful shutdown by closing the server and database connections.
 */
function shutdown() {
  if (server.listening) {
    logger.info("Conductor is shutting down...");
    server.close(async () => {
      await mongoose.disconnect().catch((err) => {
        logger.error({ err }, "Error gracefully closing MongoDB connection");
      });
      logger.info("Conductor shutdown successfully.");
    });
  }
}

// Register shutdown signal listeners
const signals = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 };
Object.keys(signals).forEach((signal) => process.on(signal, shutdown));
