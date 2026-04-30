//
// LibreTexts Conductor
// server.js
//

import "dotenv/config";
import path from "path";
import { exit } from "process";
import { fileURLToPath } from "url";
import fs from "fs";
import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import Promise from "bluebird";
import helmet from "helmet";
import { debug, debugServer, debugDB } from "./debug.js";
import api, { permalinkRouter } from "./api.js";
import { floodShield } from "./util/rateLimitHelpers.js";

// Prevent startup without ORG_ID env variable
if (!process.env.ORG_ID) {
  debug("[FATAL ERROR]: The ORG_ID environment variable is missing.");
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
      objectSrc: ["none"],
      scriptSrc: [
        "'self'",
        "https://*.libretexts.org",
        "https://*.cloudflare.com", // Cloudflare (Turnstile)
        "https://*.libretexts.net", // LibreTexts CDN
        "'sha256-wjPyHKFbRc4HkIhBXM6I/dBX9NqqdnXFbz8jONRWKCU='", // gtag.js inline
        "'sha256-pnIV3nmqaM9pcomyIJxQz4o3MHOOZiXIQ7B+8Wca1Fw='", // Matomo (traffic.libretexts.org) inline
        "*.googletagmanager.com", // gtag.js,
        "*.ssa.gov", // ANDI,
        "https://ajax.googleapis.com", // Google CDN (jQuery for ANDI)
        "https://embed.cloudflarestream.com", // Cloudflare Stream
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

// Serve API
app.use("/api/v1", floodShield, api);
app.use("/permalink", permalinkRouter);

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
app.use(express.static(clientDist));

// Serve runtime env config for frontend use. Loaded via <script src="/env.js"> in index.html to avoid CSP issues with inline scripts.
const appEnv = process.env.APP_ENV ?? "production";
const envJs = `window.__APP_ENV__ = ${JSON.stringify(appEnv)};`;
app.get("/env.js", (_req, res) => {
  res.setHeader("Content-Type", "application/javascript")
    .setHeader("Cache-Control", "public, max-age=31536000, immutable") // Caching to improve performance since this doesn't change after initial load
    .send(envJs);
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
app.get("/matomo-init.js", (_req, res) => {
  res.setHeader("Content-Type", "application/javascript")
    .setHeader("Cache-Control", "public, max-age=31536000, immutable") // Caching to improve performance since this doesn't change after initial load
    .send(matomoJS);
});

const indexHtmlPath = path.resolve(clientDist, "index.html");
const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8");
let cliRouter = express.Router();
cliRouter.route("*").get((_req, res) => {
  res.setHeader("Content-Type", "text/html").send(indexHtml);
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
  debugServer(startupMsg);

  // Initiate MongoDB connection after server is listening
  connectToMongoDB();
});

server.on("error", (err: Error) => {
  debugServer(err);
});

/**
 * Connects to MongoDB with retry logic and error handling
 */
async function connectToMongoDB(retryCount = 0) {
  const maxRetries = 5;
  const retryDelay = 5000; // 5 seconds

  try {
    debugDB(`Attempting to connect to MongoDB (attempt ${retryCount + 1}/${maxRetries + 1})...`);

    await mongoose.connect(process.env.MONGOOSEURI ?? "", {
      maxPoolSize: process.env.ORG_ID === "libretexts" ? 100 : 25,
    });

    debugDB("✓ Connected to MongoDB Atlas.");
  } catch (err) {
    debugDB(`✗ Failed to connect to MongoDB (attempt ${retryCount + 1}/${maxRetries + 1}):`);
    debugDB(err);

    if (retryCount < maxRetries) {
      debugDB(`Retrying in ${retryDelay / 1000} seconds...`);
      setTimeout(() => connectToMongoDB(retryCount + 1), retryDelay);
    } else {
      debugDB("[FATAL ERROR]: Unable to connect to MongoDB after maximum retries.");
      debugDB("Please check MongoDB connection string and network connectivity.");
      debugDB("Exiting process.");
      // Exit the process if we can't connect to MongoDB after all retries
      exit(1);
    }
  }
}

// Handle MongoDB connection events
mongoose.connection.on("connected", () => {
  debugDB("MongoDB connection established");
});

mongoose.connection.on("error", (err) => {
  debugDB("MongoDB connection error:");
  debugDB(err);
});

mongoose.connection.on("disconnected", () => {
  debugDB("MongoDB connection lost. Attempting to reconnect...");
});

/**
 * Performs a graceful shutdown by closing the server and database connections.
 */
function shutdown() {
  if (server.listening) {
    console.log("\nConductor is shutting down...");
    server.close(async () => {
      await mongoose.disconnect().catch((e) => {
        console.error("Error gracefully closing MongoDB connection:");
        console.error(e);
      });
      console.log("Conductor shutdown successfully.\n");
    });
  }
}

// Register shutdown signal listeners
const signals = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 };
Object.keys(signals).forEach((signal) => process.on(signal, shutdown));
