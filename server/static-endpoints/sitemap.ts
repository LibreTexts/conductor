import express, { type Request, type Response, type Router } from "express";

// robots.txt and sitemap.xml are generated per-request so the base URL matches the
// deployment's actual host. A built-time URL would never be correct due to subdomain deployment model.
const SITEMAP_ROUTES = [
  "/",
  "/catalog",
  "/collections",
  "/homework",
  "/sitemap",
  "/accessibility",
  "/support",
  "/store"
];

function getBaseUrl(req: Request) {
  const host = process.env.CONDUCTOR_DOMAIN ?? "commons.libretexts.org";
  return `${req.protocol}://${host}`;
}

function handleRobotsTxt(req: Request, res: Response) {
  const body = `# https://www.robotstxt.org/robotstxt.html\nUser-agent: *\nDisallow:\n\nSitemap: ${getBaseUrl(req)}/sitemap.xml\n`;
  res.setHeader("Content-Type", "text/plain")
    .setHeader("Cache-Control", "public, max-age=3600")
    .send(body);
}

function handleSitemapXml(req: Request, res: Response) {
  const base = getBaseUrl(req);
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = SITEMAP_ROUTES.map(
    (r) => `  <url>\n    <loc>${base}${r}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
  ).join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  res.setHeader("Content-Type", "application/xml")
    .setHeader("Cache-Control", "public, max-age=3600")
    .send(body);
}

export function sitemapRouter(): Router {
  const router = express.Router();
  router.get("/robots.txt", handleRobotsTxt);
  router.get("/sitemap.xml", handleSitemapXml);
  return router;
}
