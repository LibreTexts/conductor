import { getSubdomainFromUrl } from "./helpers.js";

// Ordered table of cover-page path patterns. The semantic notion of a
// "cover page" doesn't reduce to a single rule, so this list is the
// intentional manual-maintenance surface — add new shapes here as the
// library structure evolves.
const COVER_PATTERNS: RegExp[] = [
  /^\/Courses\/[^/]+\/[^/]+/,
  /^\/Bookshelves\/[^/]+\/[^/]+/,
  /^\/Sandboxes\/[^/]+\/[^/]+/,
  /^\/Under_Construction\/[^/]+\/[^/]+/,
];

export interface CoverPageLocation {
  subdomain: string;
  coverPath: string;
}

export function extractCoverPagePath(rawUrl: string): CoverPageLocation | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!/\.libretexts\.org$/i.test(parsed.hostname)) return null;

  const subdomain = getSubdomainFromUrl(rawUrl);
  if (!subdomain) return null;

  const decodedPath = decodeURIComponent(parsed.pathname);

  for (const pattern of COVER_PATTERNS) {
    const match = decodedPath.match(pattern);
    if (match) {
      return { subdomain, coverPath: match[0] };
    }
  }

  return null;
}
