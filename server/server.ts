//
// LibreTexts Conductor
// server.js
//

import "dotenv/config";
import path from "path";
import { exit } from "process";
import { fileURLToPath } from "url";
import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import Promise from "bluebird";
import helmet from "helmet";
import { debug, debugServer, debugDB } from "./debug.js";
import api from "./api.js";

// Prevent startup without ORG_ID env variable
if (!process.env.ORG_ID) {
  debug("[FATAL ERROR]: The ORG_ID environment variable is missing.");
  exit(1);
}

const app = express();
const port = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

mongoose.Promise = Promise;
mongoose.set("debug", process.env.NODE_ENV === "development");

await mongoose
  .connect(process.env.MONGOOSEURI ?? "", {
    maxPoolSize: process.env.ORG_ID === "libretexts" ? 100 : 25,
  })
  .catch((err) => debugDB(err));
debugDB("Connected to MongoDB Atlas.");

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
app.use("/api/v1", api);

app.use("/health", (_req, res) =>
  res.send({ healthy: true, msg: "Server appears healthy." })
);

// Serve frontend assets. Use directories relative to server/dist
app.use(express.static(path.join(__dirname, "../../client/dist")));
let cliRouter = express.Router();
cliRouter.route("*").get((_req, res) => {
  res.sendFile(path.resolve(__dirname, "../../client/dist/index.html"));
});
app.use("/", cliRouter);

// Start the server
const server = app.listen(port, () => {
  let startupMsg = "";
  if (process.env.ORG_ID === "libretexts") {
    startupMsg = `Conductor is listening on ${port}`;
  } else {
    startupMsg = `Conductor (${process.env.ORG_ID}) is listening on ${port}`;
  }
  debugServer(startupMsg);
});

server.on("error", (err: Error) => {
  debugServer(err);
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
