import { childLogger } from "../../logger.js";
import { assembleUrl } from "../../util/helpers.js";

const exportLog = childLogger("book-exports");

export type BookExportKey =
  | "full-pdf"
  | "content-pdf"
  | "cover-casewrap"
  | "cover-perfectbound"
  | "thincc"
  | "page-pdfs"
  | "epub";

export type BookExportGroup = "full-book" | "publication" | "other";

export interface BookExportDefinition {
  key: BookExportKey;
  label: string;
  group: BookExportGroup;
  /**
   * Segment appended to the book's downloads base URL. `null` for exports the
   * downloads service does not produce yet.
   */
  pathSegment: string | null;
  mime: string;
  extension: string;
  /**
   * Whether the browser can render this export inline. A property of the export
   * definition, never inferred from the file extension at render time.
   */
  previewable: boolean;
  /**
   * Whether the export can be requested at all. EPUB stays `false` until
   * Shapeshift supports it.
   */
  enabled: boolean;
  description: string;
}

/**
 * Every artifact a Shapeshift compile produces, in the order the UI lists them.
 *
 * This is the single source of truth for export download URLs. `bookutils.js`
 * and `lulu-service.ts` both delegate here rather than rebuilding the paths.
 */
export const BOOK_EXPORTS: BookExportDefinition[] = [
  {
    key: "full-pdf",
    label: "Full PDF",
    group: "full-book",
    pathSegment: "pdf",
    mime: "application/pdf",
    extension: "pdf",
    previewable: true,
    enabled: true,
    description:
      "The entire book, including front and back matter, as a single PDF.",
  },
  {
    key: "content-pdf",
    label: "Content PDF",
    group: "publication",
    pathSegment: "content",
    mime: "application/pdf",
    extension: "pdf",
    previewable: true,
    enabled: true,
    description: "The book's interior pages, formatted for print production.",
  },
  {
    key: "cover-casewrap",
    label: "Casewrap cover PDF",
    group: "publication",
    pathSegment: "cover-casewrap",
    mime: "application/pdf",
    extension: "pdf",
    previewable: true,
    enabled: true,
    description: "Wraparound cover sized for a hardcover printing.",
  },
  {
    key: "cover-perfectbound",
    label: "Perfect bound cover PDF",
    group: "publication",
    pathSegment: "cover-perfectbound",
    mime: "application/pdf",
    extension: "pdf",
    previewable: true,
    enabled: true,
    description: "Wraparound cover sized for a paperback printing.",
  },
  {
    key: "thincc",
    label: "ThinCC",
    group: "other",
    pathSegment: "thincc",
    mime: "application/vnd.ims.imsccv1p1",
    extension: "imscc",
    previewable: false,
    enabled: true,
    description:
      "Common Cartridge package for importing the book into Canvas, Moodle, Blackboard, or D2L.",
  },
  {
    key: "page-pdfs",
    label: "Page PDFs",
    group: "other",
    pathSegment: "pages",
    mime: "application/zip",
    extension: "zip",
    previewable: false,
    enabled: true,
    description: "A ZIP archive containing one PDF per page of the book.",
  },
  {
    key: "epub",
    label: "EPUB",
    group: "other",
    pathSegment: null,
    mime: "application/epub+zip",
    extension: "epub",
    previewable: false,
    enabled: false,
    description: "Reflowable EPUB. Not yet produced by Shapeshift.",
  },
];

export const getExportDefinition = (
  key: BookExportKey,
): BookExportDefinition | undefined => BOOK_EXPORTS.find((e) => e.key === key);

/**
 * Exports that can actually be fetched today.
 */
export const getEnabledExports = (): BookExportDefinition[] =>
  BOOK_EXPORTS.filter((e) => e.enabled && e.pathSegment);

/**
 * Root of the downloads service for a Book.
 *
 * Defaults to the production host so an unset `DOWNLOADS_BASE_URL` keeps these
 * links identical to what the legacy generators produced.
 */
export const getDownloadsBaseURL = (bookID: string): string => {
  const host =
    process.env.DOWNLOADS_BASE_URL || "https://downloads.libretexts.org";
  return assembleUrl([host, "api/v1/download", bookID]);
};

/**
 * Download URL for one export, or an empty string when the export has no
 * artifact (EPUB) or the bookID is missing.
 */
export const getExportURL = (bookID: string, key: BookExportKey): string => {
  if (!bookID) return "";
  const definition = getExportDefinition(key);
  if (!definition?.pathSegment) return "";
  return assembleUrl([getDownloadsBaseURL(bookID), definition.pathSegment]);
};

export interface BookExportProbe {
  key: BookExportKey;
  available: boolean;
  sizeBytes?: number;
  generatedAt?: string;
  downloadURL: string;
}

/**
 * How long a probe set is reused before the downloads host is asked again.
 *
 * The drawer polls while a job runs, so without this every tick would fan out
 * seven requests against the downloads service for data that changes once per
 * compile.
 */
const PROBE_CACHE_TTL_MS = 60_000;

const probeCache = new Map<string, { at: number; probes: BookExportProbe[] }>();

const HEAD_TIMEOUT_MS = 5_000;

/**
 * Asks the downloads service what it holds for one export.
 *
 * Availability is a real question: a compile can report success while silently
 * failing to write one artifact, so the UI needs to know which files are
 * actually there rather than assuming a finished job produced all of them.
 *
 * Never throws. A timeout, a network error, or a non-2xx all mean "not
 * available" — a probe failure must not fail the manifest request.
 */
const probeExport = async (
  bookID: string,
  definition: BookExportDefinition,
): Promise<BookExportProbe> => {
  const downloadURL = getExportURL(bookID, definition.key);
  const unavailable: BookExportProbe = {
    key: definition.key,
    available: false,
    downloadURL,
  };
  if (!downloadURL) return unavailable;

  try {
    const res = await fetch(downloadURL, {
      method: "HEAD",
      signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
    });
    if (!res.ok) return unavailable;

    const lengthHeader = res.headers.get("content-length");
    const parsedLength = lengthHeader ? Number.parseInt(lengthHeader, 10) : NaN;
    const modifiedHeader = res.headers.get("last-modified");
    const parsedModified = modifiedHeader ? new Date(modifiedHeader) : null;

    return {
      key: definition.key,
      available: true,
      downloadURL,
      ...(Number.isFinite(parsedLength) && parsedLength > 0
        ? { sizeBytes: parsedLength }
        : {}),
      ...(parsedModified && !Number.isNaN(parsedModified.valueOf())
        ? { generatedAt: parsedModified.toISOString() }
        : {}),
    };
  } catch (err) {
    exportLog.warn(
      { err, bookID, exportKey: definition.key },
      "Export availability probe failed",
    );
    return unavailable;
  }
};

/**
 * Builds the export manifest for a Book by asking the downloads service
 * directly. Shapeshift reports whole-job status only, so per-export size and
 * availability have no other source.
 */
export const getBookExportManifest = async (
  bookID: string,
  { skipCache = false }: { skipCache?: boolean } = {},
): Promise<BookExportProbe[]> => {
  const cached = probeCache.get(bookID);
  if (!skipCache && cached && Date.now() - cached.at < PROBE_CACHE_TTL_MS) {
    return cached.probes;
  }

  const probes = await Promise.all(
    getEnabledExports().map((definition) => probeExport(bookID, definition)),
  );

  // Exports with no artifact to probe still belong in the manifest so the rail
  // can render every row, disabled ones included, from one list.
  const unprobeable: BookExportProbe[] = BOOK_EXPORTS.filter(
    (e) => !e.enabled || !e.pathSegment,
  ).map((e) => ({
    key: e.key,
    available: false,
    downloadURL: "",
  }));

  const manifest = [...probes, ...unprobeable].sort(
    (a, b) =>
      BOOK_EXPORTS.findIndex((e) => e.key === a.key) -
      BOOK_EXPORTS.findIndex((e) => e.key === b.key),
  );

  probeCache.set(bookID, { at: Date.now(), probes: manifest });
  return manifest;
};

/**
 * Drops a Book's cached probes so the next manifest request re-reads the
 * downloads service. Called when a compile finishes.
 */
export const invalidateBookExportManifest = (bookID: string): void => {
  probeCache.delete(bookID);
};
