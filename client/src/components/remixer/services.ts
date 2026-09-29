import { Book } from "../../types";
import {
  GetRemixerDisplayTitleOptions,
  libraries,
  Library,
  matterNodesUrlEndings,
  matterNodeValidTitles,
  NumberingType,
  PathLevelFormat,
  RemixerSubPage,
} from "./model";

export type DropPosition = "before" | "inside" | "after";

export interface LocalDraft {
  currentBook: RemixerSubPage[];
  autoNumbering?: boolean;
  copyModeState?: string;
  pathLevelFormats?: PathLevelFormat[];
  savedAt: number;
}

const LOCAL_DRAFT_KEY = (projectId: string) => `remixer_draft_${projectId}`;

/** Fired in the same tab when a remixer local draft is written or cleared. */
export const LOCAL_DRAFT_CHANGE_EVENT = "remixer-local-draft-change";

function notifyLocalDraftChange(projectId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(LOCAL_DRAFT_CHANGE_EVENT, {
      detail: { projectId },
    }),
  );
}

export function getLocalDraft(projectId: string): LocalDraft | null {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.currentBook) || parsed.currentBook.length === 0)
      return null;
    // Strip any persisted "[object Object]" marker — the server migration never touches localStorage.
    parsed.pathLevelFormats = sanitizePathLevelFormats(parsed.pathLevelFormats);
    parsed.currentBook = parsed.currentBook.map((node: RemixerSubPage) =>
      typeof node.formattedPath === "string" &&
      node.formattedPath.includes(OBJECT_OBJECT_MARKER)
        ? {
            ...node,
            formattedPath: stripObjectObjectMarker(node.formattedPath),
          }
        : node,
    );
    return parsed as LocalDraft;
  } catch {
    return null;
  }
}

export function dumpProjectToLocalStorageToJsonFile({
  projectID,
  projectName,
}: {
  projectID: string;
  projectName: string | undefined;
}): void {
  try {
    const draft = getLocalDraft(projectID);
    if (!draft) return;

    const safeName = (projectName ?? projectID).replace(/[\\/?:%*|"<>]/g, "_");
    const blob = new Blob([JSON.stringify(draft, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch {
    // ignore (localStorage unavailable / invalid JSON)
  }
}

export function setLocalDraft(projectId: string, draft: LocalDraft): void {
  try {
    localStorage.setItem(LOCAL_DRAFT_KEY(projectId), JSON.stringify(draft));
    notifyLocalDraftChange(projectId);
  } catch {
    // localStorage quota exceeded or unavailable
  }
}

export function clearLocalDraft(projectId: string): void {
  try {
    localStorage.removeItem(LOCAL_DRAFT_KEY(projectId));
    notifyLocalDraftChange(projectId);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Path/number helpers
// ---------------------------------------------------------------------------

/** Literal Mongoose-coerced marker from a once-object prefix; see StripObjectObjectFromRemixerPaths migration. */
export const OBJECT_OBJECT_MARKER = "[object Object]";

/** Coerce to string and remove any persisted "[object Object]" marker (from prefix or formattedPath). */
export const stripObjectObjectMarker = (value: unknown): string =>
  typeof value === "string" ? value.split(OBJECT_OBJECT_MARKER).join("") : "";

/** Return a new pathLevelFormats array with every prefix coerced to string and the marker stripped. */
export const sanitizePathLevelFormats = (
  formats: PathLevelFormat[] | undefined,
): PathLevelFormat[] =>
  (formats ?? []).map((f) => ({
    ...f,
    prefix: stripObjectObjectMarker(f.prefix),
  }));

export const stripLeadingNumbering = (value: string): string =>
  value.replace(/^\s*\d+(?:\.\d+)*\s*[:.\-]\s*/, "").trim();

/**
 * Stored titles often duplicate the computed path prefix ("1.2: Title").
 * With auto-numbering, treat everything before the rightmost significant ":"
 * (one that still has non-whitespace text after it) as replaceable numbering/prefix metadata.
 */
export const stripDefaultTitlePrefixBeforeColon = (value: string): string => {
  for (
    let index = value.lastIndexOf(":");
    index >= 0;
    index = value.lastIndexOf(":", index - 1)
  ) {
    const remainder = value.slice(index + 1);
    if (remainder.trim().length > 0) {
      return remainder.trim();
    }
  }
  return value.trim();
};

/**
 * Colons are the namespace/numbering separator in MindTouch page paths, so they
 * must never survive into an individual page title. Book (cover) titles are
 * exempt and keep colons verbatim.
 */
export const sanitizeRemixerPageTitle = (
  value: string,
  trim: boolean = true,
): string => {
  const s = value.replace(/:/g, "-");
  return trim ? s.trim() : s;
};

/**
 * Canonical editable form of a stored title: the autonumber prefix is removed
 * (numbering is re-applied at render time by `getRemixerDisplayTitle`) and any
 * remaining colons are hyphenated.
 *
 * This is the single source of truth for title normalization. `EditPanel` uses
 * it to seed the title field and `handleSaveEdit` uses it on both sides of its
 * change comparison, so opening a page and saving without edits is a genuine
 * no-op rather than a phantom rename. Idempotent: canonical input is returned
 * unchanged.
 */
export const toEditableRemixerTitle = (
  value: string,
  isBookRoot: boolean,
): string => {
  if (isBookRoot) return value.trim();
  return sanitizeRemixerPageTitle(
    stripDefaultTitlePrefixBeforeColon(stripLeadingNumbering(value)),
  );
};

/**
 * The book root is the cover page. `parentID` is normally "-1" for it, but match
 * on the project's cover id too so both call sites agree on one definition.
 */
export const isRemixerBookRoot = (
  page: Pick<RemixerSubPage, "@id" | "parentID"> | undefined,
  coverPageId: string | undefined,
): boolean => {
  if (!page) return false;
  if (!page.parentID || page.parentID === "-1") return true;
  return !!coverPageId && page["@id"] === coverPageId;
};

/**
 * Title used to detect duplicate siblings. The raw title is kept as-is (including any
 * literal "(n)" the user typed) so that a manually-typed "(1)" is never stripped away —
 * it's treated as part of that node's real identity, not an auto-generated suffix.
 */
const normalizedSiblingTitleForDuplicateCheck = (
  node: RemixerSubPage,
): string => {
  const raw = (node["@title"] || node.title || "").trim();
  return node.formattedPathOverride === true
    ? stripLeadingNumbering(raw).toLowerCase()
    : stripDefaultTitlePrefixBeforeColon(
        stripLeadingNumbering(raw),
      ).toLowerCase();
};

/**
 * When siblings under the same parent share the exact same title (case-insensitive),
 * sets `siblingTitleIndex` on duplicates: 0 for the first, 1+ for the rest.
 * Only index > 0 is shown in the UI as (n). Deleted nodes are excluded.
 *
 * Candidate indices that would make a generated display (`${title} (n)`) collide with
 * another sibling's literal title are skipped, so a manually-typed "(n)" title never
 * conflicts with an auto-generated one.
 */
export const applySiblingDuplicateTitleSuffixes = (
  book: RemixerSubPage[],
): RemixerSubPage[] => {
  const indexById = new Map<string, number>();
  const byParent = new Map<string, RemixerSubPage[]>();
  const isDeletedNode = (node: RemixerSubPage): boolean =>
    node.deletedItem === true || node.isDeleted === true;

  book.forEach((node) => {
    if (isDeletedNode(node)) return;
    const parentKey = node.parentID ?? "-1";
    const siblings = byParent.get(parentKey) ?? [];
    siblings.push(node);
    byParent.set(parentKey, siblings);
  });

  byParent.forEach((siblings) => {
    const normalizedByNodeId = new Map<string, string>();
    siblings.forEach((node) => {
      normalizedByNodeId.set(
        node["@id"],
        normalizedSiblingTitleForDuplicateCheck(node),
      );
    });
    const takenTitles = new Set(normalizedByNodeId.values());

    const byTitle = new Map<string, RemixerSubPage[]>();
    siblings.forEach((node) => {
      const normalized = normalizedByNodeId.get(node["@id"]);
      if (!normalized) return;
      const group = byTitle.get(normalized) ?? [];
      group.push(node);
      byTitle.set(normalized, group);
    });

    byTitle.forEach((group, baseTitle) => {
      if (group.length <= 1) return;
      let candidateIndex = 1;
      group.forEach((node, position) => {
        if (position === 0) {
          indexById.set(node["@id"], 0);
          return;
        }
        while (takenTitles.has(`${baseTitle} (${candidateIndex})`)) {
          candidateIndex += 1;
        }
        indexById.set(node["@id"], candidateIndex);
        takenTitles.add(`${baseTitle} (${candidateIndex})`);
        candidateIndex += 1;
      });
    });
  });

  return book.map((node) => {
    const nextIndex = indexById.get(node["@id"]) ?? 0;
    const currentIndex = node.siblingTitleIndex ?? 0;
    if (nextIndex === currentIndex) return node;
    if (nextIndex === 0) {
      if (node.siblingTitleIndex === undefined) return node;
      const { siblingTitleIndex: _removed, ...rest } = node;
      return rest;
    }
    return { ...node, siblingTitleIndex: nextIndex };
  });
};

export const appendSiblingTitleSuffix = (
  displayTitle: string,
  page: RemixerSubPage,
): string => {
  const index = page.siblingTitleIndex ?? 0;
  if (index === 0) return displayTitle;
  return `${displayTitle} (${index})`;
};

const normalizedMatterTitle = (node: RemixerSubPage): string =>
  stripLeadingNumbering(node["@title"] || node.title || "").toLowerCase();

/**
 * CXOne / flat JSON use `"uri.ui"`; Mongoose toObject() expands that path to
 * nested `{ uri: { ui } }`, so bracket access on `"uri.ui"` can miss the value.
 */
export const getRemixerPageUriUi = (
  page: RemixerSubPage | undefined,
): string => {
  if (!page) return "";
  const flat = page["uri.ui"];
  if (typeof flat === "string" && flat.length > 0) return flat;
  const nested = (page as unknown as { uri?: { ui?: unknown } }).uri?.ui;
  return typeof nested === "string" ? nested : "";
};

export const isFrontMatterNode = (node: RemixerSubPage): boolean => {
  if (normalizedMatterTitle(node) === "front matter") return true;
  const uri = (getRemixerPageUriUi(node) || node["@href"] || "").toLowerCase();
  return uri.includes("front_matter");
};

export const isBackMatterNode = (node: RemixerSubPage): boolean => {
  if (normalizedMatterTitle(node) === "back matter") return true;
  const uri = (getRemixerPageUriUi(node) || node["@href"] || "").toLowerCase();
  return uri.includes("back_matter");
};

/** True for the Front Matter / Back Matter container pages (not their children). */
export const isMatterRootNode = (node: RemixerSubPage): boolean => {
  const title = normalizedMatterTitle(node);
  return title === "front matter" || title === "back matter";
};

/**
 * Structural default pages under front/back matter that stay locked and
 * unnumbered (TitlePage, Index, etc.). Matter roots are not included.
 */
export const isDefaultMatterPage = (node: RemixerSubPage): boolean => {
  if (node.addedItem) return false;
  if (isMatterRootNode(node)) return false;
  const uri = getRemixerPageUriUi(node).toLowerCase();
  const title = (node["@title"] || node.title || "").trim().toLowerCase();
  const isURLMatch = matterNodesUrlEndings.some((ending) =>
    uri.includes(ending.toLowerCase()),
  );
  const isTitleMatch = matterNodeValidTitles.some(
    (t) => title === t.toLowerCase(),
  );
  return isURLMatch && isTitleMatch;
};

/**
 * Fixed URL slots of the LibreTexts default matter pages (`01%3A_TitlePage`,
 * `10%3A_Index`, …). Mirrors `createDefaultFrontMatter`/`createDefaultBackMatter`
 * in the server's BookService.
 */
const DEFAULT_MATTER_PAGE_SLOTS: Record<string, number> = {
  titlepage: 1,
  infopage: 2,
  "table of contents": 3,
  licensing: 4,
  index: 10,
  glossary: 20,
  "detailed licensing": 30,
};

const padMatterSlot = (n: number): string => String(n).padStart(2, "0");

/**
 * Slots for custom pages under a matter root, anchored on the default page
 * directly above them so they keep their place between the defaults:
 * - Front (defaults 01–04): `01.01`, `01.02`, `02.01`… (`00.01` before TitlePage).
 * - Back (defaults 10/20/30): `11`, `12`, `21`… (`01`… before Index). A run
 *   that would reach the next default's slot continues as `19.01`, `19.02`….
 * Children are taken in their current sibling order; excluded (deleted)
 * customs get no slot and don't consume one.
 */
const computeMatterCustomSlots = (
  children: RemixerSubPage[],
  isBack: boolean,
  isExcluded: (node: RemixerSubPage) => boolean,
): Map<string, string> => {
  const defaultSlot = (node: RemixerSubPage): number | null => {
    if (!isDefaultMatterPage(node)) return null;
    const title = (node["@title"] || node.title || "").trim().toLowerCase();
    return DEFAULT_MATTER_PAGE_SLOTS[title] ?? null;
  };

  const slots = new Map<string, string>();
  let anchor = 0;
  let count = 0;
  children.forEach((child, index) => {
    const ownSlot = defaultSlot(child);
    if (ownSlot !== null) {
      anchor = ownSlot;
      count = 0;
      return;
    }
    if (isExcluded(child)) return;
    count += 1;
    if (!isBack) {
      slots.set(child["@id"], `${padMatterSlot(anchor)}.${padMatterSlot(count)}`);
      return;
    }
    const nextDefault = children
      .slice(index + 1)
      .map(defaultSlot)
      .find((slot): slot is number => slot !== null);
    const candidate = anchor + count;
    slots.set(
      child["@id"],
      nextDefault === undefined || candidate < nextDefault
        ? padMatterSlot(candidate)
        : `${padMatterSlot(nextDefault - 1)}.${padMatterSlot(candidate - nextDefault + 1)}`,
    );
  });
  return slots;
};

/** Path segment as integer for formatting ("0" → 0, "3" → 3). */
export const parsePathSegmentOrdinal = (segment: string): number => {
  const t = segment.trim();
  if (t === "") return 1;
  const n = Number.parseInt(t, 10);
  if (Number.isFinite(n) && String(n) === t) return n;
  return Math.max(1, Number(segment) || 1);
};

export const arePathNumbersEqual = (
  left?: string[],
  right?: string[],
): boolean => {
  const l = left ?? [];
  const r = right ?? [];
  if (l.length !== r.length) return false;
  const norm = (s: string) => s.trim().replace(/^0+(?=\d)/, "");
  return l.every((segment, index) => norm(segment) === norm(r[index] ?? ""));
};

export const cloneBook = (book: RemixerSubPage[]): RemixerSubPage[] =>
  book.map((page) => ({ ...page }));

export const toRoman = (value: number): string => {
  if (value <= 0) return "I";
  const numerals: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let remaining = Math.floor(value);
  let result = "";
  for (const [num, symbol] of numerals) {
    while (remaining >= num) {
      result += symbol;
      remaining -= num;
    }
  }
  return result || "I";
};

export const toAlphabetic = (value: number): string => {
  const normalized = Math.max(1, Math.floor(value));
  let n = normalized;
  let result = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
};

export const getFormattedTokenByType = (
  value: number,
  type: NumberingType,
): string => {
  if (type === "none") return "";
  if (type === "alphabetic") return toAlphabetic(value);
  if (type === "alphabetic_lower") return toAlphabetic(value).toLowerCase();
  if (type === "roman") return toRoman(value);
  if (type === "roman_lower") return toRoman(value).toLowerCase();
  return String(value);
};

export const getStartToken = (start: number, type: NumberingType): string => {
  if (type === "none") return "";
  return getFormattedTokenByType(Number.isFinite(start) ? start : 1, type);
};

/** Join per-level tokens using the delimiter configured for each segment's own level. */
export const joinLeveledPathParts = (
  parts: { level: number; token: string }[],
  pathLevelFormats: PathLevelFormat[],
): string => {
  if (parts.length === 0) return "";
  let s = parts[0].token;
  for (let i = 1; i < parts.length; i++) {
    const format = pathLevelFormats.find(
      (item) => item.level === parts[i].level,
    );
    const delimiter = format?.delimiter ?? ".";
    s = `${s}${delimiter}${parts[i].token}`;
  }
  return s;
};

/**
 * Splits the auto-numbered path into its two independently-editable pieces:
 * `prefix` (the deepest level's configured text label, e.g. "Section ") and
 * `index` (the joined numeric/ordinal path, e.g. "2.1"). Matches `buildBookPaths`
 * `toPaths` rules. `excludeParent` drops only the immediate parent's index from
 * the chain (grandparents stay); this level's prefix still wraps the joined index.
 */
export const splitFormattedPathParts = (
  segments: string[],
  pathLevelFormats: PathLevelFormat[],
  startLevel: number,
): { prefix: string; index: string } => {
  const parts: { level: number; token: string }[] = [];
  let prefix = "";
  let index = "";
  segments.forEach((segment, i) => {
    const level = startLevel + i;
    const format = pathLevelFormats.find((item) => item.level === level);
    const start = Number.isFinite(format?.start) ? format!.start : 1;
    const type: NumberingType = format?.type ?? "numeric";
    const value = start + parsePathSegmentOrdinal(segment) - 1;
    const token = getFormattedTokenByType(value, type);
    const tokenExists = token.trim().length > 0;
    const levelPrefix = stripObjectObjectMarker(format?.prefix);

    if (format?.excludeParent) {
      if (tokenExists) {
        if (parts.length > 0) parts.pop();
        parts.push({ level, token });
      } else {
        parts.length = 0;
      }
      index = joinLeveledPathParts(parts, pathLevelFormats);
      prefix = levelPrefix;
      return;
    }

    if (tokenExists) {
      parts.push({ level, token });
      index = joinLeveledPathParts(parts, pathLevelFormats);
      prefix = levelPrefix;
    }
  });
  return { prefix, index };
};

/**
 * Joins a numbering prefix and index, inserting a single space between them
 * when neither already has whitespace at the boundary (e.g. "Chapter" + "5"
 * → "Chapter 5", but "Chapter " + "5" or "Chapter" + " 5" are left as-is).
 */
export const joinPrefixAndIndex = (prefix: string, index: string): string => {
  if (!prefix) return index;
  if (!index) return prefix;
  const needsSpace = !/\s$/.test(prefix) && !/^\s/.test(index);
  return needsSpace ? `${prefix} ${index}` : `${prefix}${index}`;
};

/**
 * Formatted display path from ordinal segments — matches `buildBookPaths` `toPaths` rules.
 * `excludeParent` drops only the immediate parent's index from the chain (grandparents stay);
 * this level's prefix still wraps the joined numeric path.
 */
export const formatOrdinalSegmentsToFormattedPath = (
  segments: string[],
  pathLevelFormats: PathLevelFormat[],
  startLevel: number,
): string => {
  const { prefix, index } = splitFormattedPathParts(
    segments,
    pathLevelFormats,
    startLevel,
  );
  return prefix ? joinPrefixAndIndex(prefix, index) : index;
};

/**
 * Backfills `formattedPathPrefix`/`formattedPathIndex` for a stored combined `formattedPath`
 * override that predates the split fields (e.g. round-tripped through the backend on
 * publish/reload, which only persists the combined string). Matches against configured
 * level prefixes (longest match wins); falls back to putting the whole string in `index`.
 */
export const splitStoredFormattedPath = (
  formattedPath: string,
  pathLevelFormats: PathLevelFormat[],
): { prefix: string; index: string } => {
  const candidatePrefixes = pathLevelFormats
    .map((format) => format.prefix ?? "")
    .filter((prefix) => prefix.length > 0)
    .sort((a, b) => b.length - a.length);
  const matched = candidatePrefixes.find((prefix) =>
    formattedPath.startsWith(prefix),
  );
  if (matched) {
    return { prefix: matched, index: formattedPath.slice(matched.length) };
  }
  return { prefix: "", index: formattedPath };
};

/** Builds the path prefix string from ordinal segments (same rules as book `formattedPath`). */
export const buildFormattedPathFromNumberPath = (
  numberPath: string[],
  pathLevelFormats: PathLevelFormat[],
  options?: { startLevel?: number },
): string =>
  formatOrdinalSegmentsToFormattedPath(
    numberPath,
    pathLevelFormats,
    options?.startLevel ?? 1,
  );

/**
 * If an ancestor has `formattedPathOverride`, build `ancestorPrefix.<suffix>` from this node's
 * path segments below that ancestor (e.g. parent `CH-2A` → child `CH-2A.1`).
 */
export const resolveInheritedFormattedPathPrefix = (
  page: RemixerSubPage,
  numberPath: string[],
  pathLevelFormats: PathLevelFormat[],
  nodesById: Map<string, RemixerSubPage>,
  ordinalPathById: Map<string, string[]>,
): string | null => {
  let parentId = page.parentID ?? "-1";
  while (parentId !== "-1") {
    const ancestor = nodesById.get(parentId);
    if (!ancestor) break;
    if (ancestor.formattedPathOverride === true) {
      const ancestorDepth = (ordinalPathById.get(parentId) ?? []).length;
      const relative = numberPath.slice(ancestorDepth);
      if (relative.length === 0) return null;
      const firstRelLevel = ancestorDepth + 1;
      const firstRelFormat = pathLevelFormats.find(
        (item) => item.level === firstRelLevel,
      );
      const suffix = formatOrdinalSegmentsToFormattedPath(
        relative,
        pathLevelFormats,
        firstRelLevel,
      );
      const prefix = stripObjectObjectMarker(ancestor.formattedPath).trim();
      if (!suffix) return prefix || null;
      // excludeParent on first relative level: restart display (no inherited prefix), same as non-inherited tree.
      if (firstRelFormat?.excludeParent) {
        return suffix;
      }
      // Empty override prefix means "no prefix" — children keep only their relative suffix.
      if (!prefix) return suffix;
      const joinDelim = firstRelFormat?.delimiter ?? ".";
      return `${prefix}${joinDelim}${suffix}`;
    }
    parentId = ancestor.parentID ?? "-1";
  }
  return null;
};

export const getRemixerDisplayTitle = (
  page: RemixerSubPage,
  numberPath: string[],
  /** True on front/back matter nodes and all descendants — no title autonumber prefix. */
  inMatterNoNumberSubtree: boolean,
  inDeletedBranch: boolean,
  options: GetRemixerDisplayTitleOptions,
): string => {
  const {
    isBookTree,
    autoNumbering,
    pathLevelFormats = [],
    remixerPathLookup,
  } = options;
  const rawTitle = page["@title"] || page.title || "";
  if (!isBookTree) return rawTitle;
  if (!autoNumbering) return rawTitle;
  // Book root (numberPath.length === 0) has no autonumber prefix to strip —
  // its title is the book title and may legitimately contain ":".
  if (numberPath.length === 0 || page.parentID === "-1") {
    return rawTitle;
  }

  let cleanTitle = stripLeadingNumbering(rawTitle);
  cleanTitle = stripDefaultTitlePrefixBeforeColon(cleanTitle);
  if (inDeletedBranch || inMatterNoNumberSubtree) {
    return cleanTitle;
  }

  const overridden = page.formattedPathOverride === true;
  if (overridden) {
    const overriddenFormattedPath = stripObjectObjectMarker(
      page.formattedPath,
    ).trim();
    // Empty override prefix/index means show title only (no autonumber prefix).
    return overriddenFormattedPath
      ? `${overriddenFormattedPath}: ${cleanTitle}`
      : cleanTitle;
  }
  // Skipped from the sequence and not separately given custom text — no number to show.
  if (page.skipAutoNumber === true) {
    return cleanTitle;
  }
  const inherited =
    remixerPathLookup &&
    resolveInheritedFormattedPathPrefix(
      page,
      numberPath,
      pathLevelFormats,
      remixerPathLookup.nodesById,
      remixerPathLookup.ordinalPathById,
    );
  if (inherited) {
    return `${inherited}: ${cleanTitle}`;
  }
  const formattedPath = buildFormattedPathFromNumberPath(
    numberPath,
    pathLevelFormats,
  );
  return formattedPath ? `${formattedPath}: ${cleanTitle}` : cleanTitle;
};

const isDeletedForPath = (node: RemixerSubPage): boolean =>
  node.deletedItem === true || node.isDeleted === true;

/**
 * Ordinal path segments per page: book root []; front matter ["0"]; chapters ["1"]…;
 * back matter root uses last index (chapter count + 1). Nested: ["1","1"], ["0","1"], …
 * Single top-level book node gets [] and layout applies to its children.
 */
export const computeRemixerOrdinalPathsMap = (
  book: RemixerSubPage[],
  pathLevelFormats: PathLevelFormat[] = [],
  options: { ignoreOverrides?: boolean } = {},
): Map<string, string[]> => {
  const { ignoreOverrides = false } = options;
  // A "Skip Auto Number" page keeps its own (internal, unshown) ordinal slot, but is
  // excluded from the count that produces its *siblings'* numbers — it isn't part of
  // the autonumber sequence, so later siblings close the gap. Independent of
  // `formattedPathOverride` (custom prefix/index text); `ignoreOverrides` suppresses
  // both, for the "what would this be automatically" preview.
  const isSkippableForSiblings = (node: RemixerSubPage): boolean =>
    !ignoreOverrides && node.skipAutoNumber === true;
  const nodesById = new Map(book.map((node) => [node["@id"], node]));
  const childrenByParent = new Map<string, RemixerSubPage[]>();

  const pushChild = (parentId: string, node: RemixerSubPage) => {
    const children = childrenByParent.get(parentId) ?? [];
    children.push(node);
    childrenByParent.set(parentId, children);
  };

  book.forEach((node) => {
    const parentId = node.parentID ?? "-1";
    if (parentId === "-1" || !nodesById.has(parentId)) {
      pushChild("-1", node);
    } else {
      pushChild(parentId, node);
    }
  });

  const ordinalPathById = new Map<string, string[]>();
  const visited = new Set<string>();

  /** Global running counter per level when `continue` is enabled for that level. */
  const continuedOrdinalByLevel = new Map<number, number>();

  const rootRow = childrenByParent.get("-1") ?? [];
  const singletonBookRootId = rootRow.length === 1 ? rootRow[0]["@id"] : null;

  const isRootLevelLayout = (
    parentId: string,
    parentPath: string[],
  ): boolean => {
    if (parentId === "-1" && parentPath.length === 0) return true;
    if (
      singletonBookRootId &&
      parentId === singletonBookRootId &&
      parentPath.length === 0
    ) {
      return true;
    }
    return false;
  };

  const assignUnderParent = (
    parentId: string,
    parentPath: string[],
    parentInDeletedBranch: boolean,
    parentInMatterBranch: boolean = false,
  ) => {
    const children = childrenByParent.get(parentId) ?? [];

    if (isRootLevelLayout(parentId, parentPath)) {
      const chapterSlotNodes = children.filter(
        (c) =>
          !isFrontMatterNode(c) && !isBackMatterNode(c) && !isDeletedForPath(c),
      );
      const visibleChapterSlotNodes = chapterSlotNodes.filter(
        (c) => !isSkippableForSiblings(c),
      );
      const backMatterSegment = String(visibleChapterSlotNodes.length + 1);

      for (const child of children) {
        if (isDeletedForPath(child) || parentInDeletedBranch) {
          const path = [...parentPath];
          ordinalPathById.set(child["@id"], path);
          visited.add(child["@id"]);
          assignUnderParent(child["@id"], path, true, false);
          continue;
        }
        let nextPath: string[];
        const childIsMatter =
          isFrontMatterNode(child) || isBackMatterNode(child);
        if (isFrontMatterNode(child)) {
          nextPath = [...parentPath, "0"];
        } else if (isBackMatterNode(child)) {
          nextPath = [...parentPath, backMatterSegment];
        } else {
          const idx = isSkippableForSiblings(child)
            ? chapterSlotNodes.indexOf(child)
            : visibleChapterSlotNodes.indexOf(child);
          nextPath =
            idx >= 0 ? [...parentPath, String(idx + 1)] : [...parentPath];
        }
        ordinalPathById.set(child["@id"], nextPath);
        visited.add(child["@id"]);
        assignUnderParent(child["@id"], nextPath, false, childIsMatter);
      }
      return;
    }

    const parentNode = nodesById.get(parentId);
    const parentIsMatterRoot = parentNode
      ? isMatterRootNode(parentNode)
      : false;

    // Under front/back matter roots: defaults stay unnumbered in pathNumber;
    // custom pages get a single-segment slot relative to the default above them
    // (`01.01`, `11`, …) that is used verbatim for publish slugs.
    if (parentIsMatterRoot) {
      const isBack = parentNode ? isBackMatterNode(parentNode) : false;
      const customSlots = computeMatterCustomSlots(
        children,
        isBack,
        (c) => isDeletedForPath(c) || parentInDeletedBranch,
      );
      for (const child of children) {
        if (isDeletedForPath(child) || parentInDeletedBranch) {
          const path = [...parentPath];
          ordinalPathById.set(child["@id"], path);
          visited.add(child["@id"]);
          assignUnderParent(child["@id"], path, true, true);
          continue;
        }
        let nextPath: string[];
        if (isDefaultMatterPage(child)) {
          nextPath = [...parentPath];
        } else {
          const slot = customSlots.get(child["@id"]);
          nextPath = slot ? [slot] : [...parentPath];
        }
        ordinalPathById.set(child["@id"], nextPath);
        visited.add(child["@id"]);
        assignUnderParent(child["@id"], nextPath, false, true);
      }
      return;
    }

    const childLevel = parentPath.length + 1;
    const levelFormat = pathLevelFormats.find((f) => f.level === childLevel);
    // matter subtrees are excluded from the global continue counter
    const shouldContinue =
      !parentInMatterBranch && levelFormat?.continue === true;

    let rawOrdinal = 0;
    let visibleOrdinal = shouldContinue
      ? (continuedOrdinalByLevel.get(childLevel) ?? 0)
      : 0;

    for (const child of children) {
      if (isDeletedForPath(child) || parentInDeletedBranch) {
        const path = [...parentPath];
        ordinalPathById.set(child["@id"], path);
        visited.add(child["@id"]);
        assignUnderParent(child["@id"], path, true, parentInMatterBranch);
        continue;
      }
      rawOrdinal += 1;
      const skippable = isSkippableForSiblings(child);
      if (!skippable) visibleOrdinal += 1;
      const nextPath = [
        ...parentPath,
        String(skippable ? rawOrdinal : visibleOrdinal),
      ];
      ordinalPathById.set(child["@id"], nextPath);
      visited.add(child["@id"]);
      assignUnderParent(child["@id"], nextPath, false, parentInMatterBranch);
    }

    if (shouldContinue) {
      continuedOrdinalByLevel.set(childLevel, visibleOrdinal);
    }
  };

  if (singletonBookRootId) {
    const only = rootRow[0];
    ordinalPathById.set(only["@id"], []);
    visited.add(only["@id"]);
    assignUnderParent(singletonBookRootId, [], false);
  } else {
    assignUnderParent("-1", [], false);
  }

  book.forEach((node) => {
    if (!visited.has(node["@id"])) {
      ordinalPathById.set(node["@id"], [String(ordinalPathById.size + 1)]);
    }
  });

  return ordinalPathById;
};

export const buildBookPaths = (
  book: RemixerSubPage[],
  pathLevelFormats: PathLevelFormat[] = [],
  options: { ignoreOverrides?: boolean } = {},
): RemixerSubPage[] => {
  const { ignoreOverrides = false } = options;
  if (book.length === 0) return book;

  const nodesById = new Map(book.map((n) => [n["@id"], n]));
  const ordinalPathById = computeRemixerOrdinalPathsMap(book, pathLevelFormats, {
    ignoreOverrides,
  });

  const toPaths = (ordinalPath: string[]) => {
    const formattedPath = formatOrdinalSegmentsToFormattedPath(
      ordinalPath,
      pathLevelFormats,
      1,
    );
    const rawParts: { level: number; token: string }[] = [];
    ordinalPath.forEach((segment, index) => {
      const level = index + 1;
      const format = pathLevelFormats.find((item) => item.level === level);
      const numericToken = segment;
      const numericTokenExists = numericToken.trim().length > 0;

      if (format?.excludeParent) {
        if (numericTokenExists) {
          if (rawParts.length > 0) rawParts.pop();
          rawParts.push({ level, token: numericToken });
        } else {
          rawParts.length = 0;
        }
        return;
      }

      if (numericTokenExists) {
        rawParts.push({ level, token: numericToken });
      }
    });
    const numberedPath = joinLeveledPathParts(rawParts, pathLevelFormats);
    return { numberedPath, formattedPath };
  };

  return book.map((node) => {
    const ordinalPath = ordinalPathById.get(node["@id"]) ?? [];
    const {
      numberedPath: computedNumberedPath,
      formattedPath: computedFormattedPath,
    } = toPaths(ordinalPath);

    const hasOverride =
      ignoreOverrides !== true && node.formattedPathOverride === true;
    const inheritedPrefix = !hasOverride
      ? resolveInheritedFormattedPathPrefix(
          node,
          ordinalPath,
          pathLevelFormats,
          nodesById,
          ordinalPathById,
        )
      : null;

    const parent = nodesById.get(node.parentID ?? "");
    // Matter customs: path slots are literal (`01.01`, `11`, …) and anchored on
    // the default pages' fixed slots. Do not apply autoNumbering start offset or
    // level delimiters, or they can collide with the defaults.
    const isMatterCustom =
      parent != null &&
      isMatterRootNode(parent) &&
      !isDefaultMatterPage(node) &&
      ordinalPath.length === 1;

    const leafSlot = isMatterCustom ? (ordinalPath[0] ?? "") : "";
    const numberedPath = isMatterCustom ? leafSlot : computedNumberedPath;
    const formattedPath = hasOverride
      ? stripObjectObjectMarker(node.formattedPath)
      : isMatterCustom
        ? leafSlot
        : (inheritedPrefix ?? computedFormattedPath);

    return {
      ...node,
      originalPathNumber: node.originalPathNumber,
      originalFormattedPathOverride: node.originalFormattedPathOverride,
      originalFormattedPath: node.originalFormattedPath,
      pathNumber: ordinalPath,
      numberedPath,
      formattedPath,
    };
  });
};

/**
 * Points draft pages a publish run already created at their live pages.
 * `createdPages` comes from the run's job record; a run that failed partway
 * still lists every page it got to. Each mapped page takes its live id, its
 * children follow it, and it stops counting as added/imported so a retry
 * doesn't create it again. Entries whose draft page isn't in `book` are
 * ignored, so applying the same list twice (or to an older draft) is safe.
 *
 * @returns The book, and how many of its pages were mapped.
 */
export const applyCreatedPageIds = (
  book: RemixerSubPage[],
  createdPages: { draftID: string; pageID: string }[] | undefined,
): { book: RemixerSubPage[]; mapped: number } => {
  if (!createdPages?.length) return { book, mapped: 0 };
  const inBook = new Set(book.map((node) => node["@id"]));
  const liveIdByDraftId = new Map(
    createdPages
      // Skip a live id the draft already has, so a page can't appear twice.
      .filter(({ draftID, pageID }) => inBook.has(draftID) && !inBook.has(pageID))
      .map(({ draftID, pageID }) => [draftID, pageID]),
  );
  if (liveIdByDraftId.size === 0) return { book, mapped: 0 };

  const mappedBook = book.map((node) => {
    const liveId = liveIdByDraftId.get(node["@id"]);
    const parentID =
      node.parentID !== undefined
        ? (liveIdByDraftId.get(node.parentID) ?? node.parentID)
        : undefined;
    if (!liveId) {
      return parentID === node.parentID ? node : { ...node, parentID };
    }
    return {
      ...node,
      "@id": liveId,
      parentID,
      addedItem: false,
      isImported: false,
    };
  });
  return { book: mappedBook, mapped: liveIdByDraftId.size };
};

/** Titles `getNewNodeTitleForDepth` gives new pages, with an optional duplicate suffix. */
const DEFAULT_NEW_PAGE_TITLE = /^new (chapter|page|subpage)( \(\d+\))?$/i;

export interface DraftTocReconcileReport {
  /** Draft-only pages that already exist in the live book (published since the draft was saved). */
  adopted: RemixerSubPage[];
  /** Live pages missing from the draft, inserted at their live position. */
  insertedFromToc: RemixerSubPage[];
  /** Pages the draft never moved that were moved in the live book; they follow the live placement. */
  relocated: RemixerSubPage[];
  /**
   * Published pages the draft still had that are gone from the live book
   * (deleted or moved out directly in the library); removed from the draft.
   * Pages the draft had already marked deleted are removed without being listed.
   */
  untracked: RemixerSubPage[];
}

/**
 * Re-bases a saved draft on the book's live TOC, so change flags describe the
 * difference from what is actually published rather than from whatever
 * baseline the draft carried when it was saved. A draft can be ahead of the
 * TOC (unpublished edits), behind it (published since, or edited directly in
 * the library), or both. The rule is: what the draft changed wins, everything
 * else follows the live book.
 *
 * - Blank pages the draft added that now exist live under the same parent with
 *   the same title adopt the live page's id, so publishing doesn't create them
 *   a second time. Imported pages and pages still carrying a default title
 *   ("New Page", …) are never matched: a title match there is too likely to be
 *   a coincidence, and adopting would silently drop the page's content.
 * - Pages the draft never moved (no moved flag, path still equal to its saved
 *   baseline) take their live parent and sibling position; pages the draft did
 *   move keep the draft placement.
 * - Live pages absent from the draft are inserted at their live position as
 *   unchanged pages.
 * - Every draft page that exists live gets its live URL, `originalPathNumber`
 *   from the live numbering (which `withDerivedStatusFlags` turns into
 *   moved/placement flags), and `renamedItem` from comparing its title with the
 *   live title.
 *
 * - Published pages that are gone from the live book are removed; children the
 *   draft added under them move up to the nearest surviving ancestor.
 */
export const reconcileDraftWithToc = (
  savedDraft: RemixerSubPage[],
  toc: RemixerSubPage[],
  pathLevelFormats: PathLevelFormat[] = [],
): { book: RemixerSubPage[]; report: DraftTocReconcileReport } => {
  const report: DraftTocReconcileReport = {
    adopted: [],
    insertedFromToc: [],
    relocated: [],
    untracked: [],
  };
  if (savedDraft.length === 0 || toc.length === 0) {
    return { book: savedDraft, report };
  }

  const parentKey = (node: RemixerSubPage): string => node.parentID ?? "-1";
  const rawTitle = (node: RemixerSubPage): string =>
    node["@title"] || node.title || "";
  const cleanTitle = (node: RemixerSubPage): string =>
    toEditableRemixerTitle(rawTitle(node), false);
  const isDeleted = (node: RemixerSubPage): boolean =>
    node.deletedItem === true || node.isDeleted === true;

  const tocById = new Map(toc.map((node) => [node["@id"], node]));

  // 0. Drop published pages that are gone live. Added/imported pages were
  // never created, so they can't be "gone"; published ids are numeric.
  const isPublishedPage = (node: RemixerSubPage): boolean =>
    !node.addedItem && /^\d+$/.test(node["@id"]);
  const goneIds = new Set(
    savedDraft
      .filter((node) => isPublishedPage(node) && !tocById.has(node["@id"]))
      .map((node) => node["@id"]),
  );
  const savedById = new Map(savedDraft.map((node) => [node["@id"], node]));
  const survivingAncestor = (id: string): string => {
    let current = id;
    while (goneIds.has(current)) {
      current = savedById.get(current)?.parentID ?? "-1";
    }
    return current;
  };
  report.untracked = savedDraft.filter(
    (node) => goneIds.has(node["@id"]) && !isDeleted(node),
  );
  const draft =
    goneIds.size === 0
      ? savedDraft
      : savedDraft
          .filter((node) => !goneIds.has(node["@id"]))
          .map((node) =>
            node.parentID && goneIds.has(node.parentID)
              ? { ...node, parentID: survivingAncestor(node.parentID) }
              : node,
          );

  const tocChildren = new Map<string, RemixerSubPage[]>();
  toc.forEach((node) => {
    const siblings = tocChildren.get(parentKey(node)) ?? [];
    siblings.push(node);
    tocChildren.set(parentKey(node), siblings);
  });

  // Placement the draft itself changed, judged against the draft's own saved
  // baseline before anything here touches it. Pages in a deleted branch are
  // judged by their flags only: the ordinal numbering collapses them onto
  // their parent's path, so their path never matches the baseline.
  const draftById = new Map(draft.map((node) => [node["@id"], node]));
  const inDeletedBranch = (node: RemixerSubPage): boolean => {
    const seen = new Set<string>();
    for (
      let current: RemixerSubPage | undefined = node;
      current && !seen.has(current["@id"]);
      current = draftById.get(parentKey(current))
    ) {
      if (isDeleted(current)) return true;
      seen.add(current["@id"]);
    }
    return false;
  };
  const draftOrdinals = computeRemixerOrdinalPathsMap(draft, pathLevelFormats);
  const movedInDraft = new Set(
    draft
      .filter((node) => {
        if (node.movedItem === true || node.isPlacementChanged === true) {
          return true;
        }
        if (inDeletedBranch(node)) return false;
        const baseline = node.originalPathNumber;
        const current = draftOrdinals.get(node["@id"]);
        return (
          !!baseline && !!current && !arePathNumbersEqual(baseline, current)
        );
      })
      .map((node) => node["@id"]),
  );

  // 1. Adopt draft-only pages that were published since the draft was saved.
  // Repeated until stable so a child can match once its parent has adopted.
  const draftIds = new Set(draft.map((node) => node["@id"]));
  const unclaimedByParent = new Map<string, RemixerSubPage[]>();
  toc.forEach((node) => {
    if (draftIds.has(node["@id"])) return;
    const list = unclaimedByParent.get(parentKey(node)) ?? [];
    list.push(node);
    unclaimedByParent.set(parentKey(node), list);
  });
  const idMap = new Map<string, string>();
  const resolveId = (id: string): string => idMap.get(id) ?? id;
  const canAdopt = (node: RemixerSubPage): boolean =>
    node.addedItem === true &&
    !isDeleted(node) &&
    // Imported pages carry `${sourceID}-…` ids; blank ones are `new-…`.
    node["@id"].startsWith("new-") &&
    node.isImported !== true &&
    !DEFAULT_NEW_PAGE_TITLE.test(cleanTitle(node));
  for (let changed = true; changed; ) {
    changed = false;
    for (const node of draft) {
      if (!canAdopt(node) || idMap.has(node["@id"])) continue;
      const candidates = unclaimedByParent.get(resolveId(parentKey(node)));
      if (!candidates?.length) continue;
      const title = cleanTitle(node).toLowerCase();
      const index = candidates.findIndex(
        (candidate) => cleanTitle(candidate).toLowerCase() === title,
      );
      if (index < 0) continue;
      const [match] = candidates.splice(index, 1);
      idMap.set(node["@id"], match["@id"]);
      changed = true;
    }
  }

  let book: RemixerSubPage[] = draft.map((node) => {
    const parentID =
      node.parentID !== undefined ? resolveId(node.parentID) : undefined;
    const liveId = idMap.get(node["@id"]);
    if (!liveId) {
      return parentID === node.parentID ? node : { ...node, parentID };
    }
    const live = tocById.get(liveId)!;
    const adopted: RemixerSubPage = {
      ...node,
      "@id": liveId,
      parentID,
      "@href": live["@href"],
      "uri.ui": live["uri.ui"],
      addedItem: false,
      isImported: false,
    };
    report.adopted.push(adopted);
    return adopted;
  });

  /**
   * Puts `node` under its live parent, right after its nearest live
   * predecessor already there in the book (else before its nearest live
   * successor, else last). Array position only matters among siblings.
   */
  const placeAtLivePosition = (
    node: RemixerSubPage,
    live: RemixerSubPage,
  ): RemixerSubPage => {
    const parentId = parentKey(live);
    book = book.filter((n) => n["@id"] !== node["@id"]);
    const bookSiblingIds = new Set(
      book.filter((n) => parentKey(n) === parentId).map((n) => n["@id"]),
    );
    const liveSiblings = tocChildren.get(parentId) ?? [];
    const position = liveSiblings.findIndex((n) => n["@id"] === live["@id"]);
    const prev = liveSiblings
      .slice(0, position)
      .reverse()
      .find((n) => bookSiblingIds.has(n["@id"]));
    const next = prev
      ? undefined
      : liveSiblings
          .slice(position + 1)
          .find((n) => bookSiblingIds.has(n["@id"]));
    const anchorIndex = book.findIndex(
      (n) => n["@id"] === (prev ?? next)?.["@id"],
    );
    const placed: RemixerSubPage = { ...node, parentID: parentId };
    if (anchorIndex < 0) {
      book.push(placed);
    } else {
      book.splice(prev ? anchorIndex + 1 : anchorIndex, 0, placed);
    }
    book = book.map((n) =>
      n["@id"] === parentId && !n["@subpages"]
        ? { ...n, "@subpages": true }
        : n,
    );
    return placed;
  };

  // 2. Pages the draft never moved follow the live book: first a changed
  // parent, then sibling order within groups the draft left untouched.
  const isLiveUnmoved = (node: RemixerSubPage): boolean =>
    tocById.has(node["@id"]) &&
    !node.addedItem &&
    !movedInDraft.has(node["@id"]);
  /** True when `id` is `ancestorId` or sits anywhere below it in the current book. */
  const isUnder = (id: string, ancestorId: string): boolean => {
    const byId = new Map(book.map((n) => [n["@id"], n]));
    const seen = new Set<string>();
    for (
      let current = byId.get(id);
      current && !seen.has(current["@id"]);
      current = byId.get(parentKey(current))
    ) {
      if (current["@id"] === ancestorId) return true;
      seen.add(current["@id"]);
    }
    return false;
  };
  const relocatedIds = new Set<string>();
  for (const live of toc) {
    const node = book.find((n) => n["@id"] === live["@id"]);
    if (!node || !isLiveUnmoved(node)) continue;
    const liveParent = parentKey(live);
    if (parentKey(node) === liveParent) continue;
    if (liveParent !== "-1" && !book.some((n) => n["@id"] === liveParent)) {
      continue;
    }
    // The draft moved the live parent into this page's own subtree (e.g. the
    // library put 21 under 23 while the draft put 23 under 21). Following the
    // live parent would make a cycle and drop both subtrees from the tree;
    // the draft's move wins, so this page keeps its draft placement.
    if (liveParent !== "-1" && isUnder(liveParent, node["@id"])) continue;
    placeAtLivePosition(node, live);
    relocatedIds.add(live["@id"]);
  }
  for (const [parentId, liveSiblings] of tocChildren) {
    const group = book.filter((n) => parentKey(n) === parentId);
    if (group.length < 2 || !group.every(isLiveUnmoved)) continue;
    const groupIds = new Set(group.map((n) => n["@id"]));
    const liveOrder = liveSiblings
      .map((n) => n["@id"])
      .filter((id) => groupIds.has(id));
    if (liveOrder.length !== group.length) continue;
    if (liveOrder.every((id, i) => group[i]["@id"] === id)) continue;
    // Rewrite the group's slots in place, in live order.
    const byId = new Map(group.map((n) => [n["@id"], n]));
    let cursor = 0;
    book = book.map((n) =>
      parentKey(n) === parentId ? byId.get(liveOrder[cursor++])! : n,
    );
    group.forEach((n, i) => {
      if (n["@id"] !== liveOrder[i]) relocatedIds.add(n["@id"]);
    });
  }

  // 3. Insert live pages the draft has never seen. TOC order is parent-first,
  // so a missing parent is inserted before its children.
  const present = new Set(book.map((node) => node["@id"]));
  for (const live of toc) {
    if (present.has(live["@id"])) continue;
    const parentId = parentKey(live);
    if (parentId !== "-1" && !present.has(parentId)) continue;
    report.insertedFromToc.push(
      placeAtLivePosition({ ...live, addedItem: false }, live),
    );
    present.add(live["@id"]);
  }

  // 4. Re-base every live page's flags on the live TOC.
  const liveOrdinals = computeRemixerOrdinalPathsMap(toc, pathLevelFormats);
  book = book.map((node) => {
    const live = tocById.get(node["@id"]);
    if (!live || node.addedItem) return node;
    const isRoot = parentKey(node) === "-1";
    const liveTitle = rawTitle(live);
    const titleChanged = isRoot
      ? rawTitle(node).trim() !== liveTitle.trim()
      : cleanTitle(node) !== cleanTitle(live);
    // Unchanged titles take the live form (with its numbering prefix) so the
    // autonumber sync compares like for like; changed ones are stored clean
    // so the sync keeps seeing them as renamed.
    const title = !titleChanged
      ? liveTitle
      : isRoot
        ? rawTitle(node)
        : cleanTitle(node);
    return {
      ...node,
      "@href": live["@href"] || node["@href"],
      "uri.ui": live["uri.ui"] || node["uri.ui"],
      title,
      "@title": title,
      renamedItem: titleChanged,
      // Stale positional flags; withDerivedStatusFlags re-derives them from
      // originalPathNumber against the live numbering.
      movedItem: false,
      isPlacementChanged: false,
      originalPathNumber:
        liveOrdinals.get(node["@id"]) ?? node.originalPathNumber,
    };
  });
  report.relocated = book.filter((node) => relocatedIds.has(node["@id"]));

  return { book, report };
};

export const withDerivedStatusFlags = (
  book: RemixerSubPage[],
): RemixerSubPage[] =>
  book.map((page) => {
    const placementChanged =
      page.addedItem === true
        ? false
        : page.originalPathNumber
          ? !arePathNumbersEqual(page.originalPathNumber, page.pathNumber)
          : false;
    return {
      ...page,
      movedItem: placementChanged,
      isDeleted: page.deletedItem === true,
      isImported: page.addedItem === true,
      isRenamed: page.renamedItem === true,
      isPlacementChanged: placementChanged,
    };
  });

/**
 * The book cover (project `liberCoverID`) keeps its `article` value from the source;
 * all other pages in the current book are set to `topic-guide`.
 */
export const applyDefaultBookArticleTypes = (
  book: RemixerSubPage[],
  coverPageId: string | undefined,
): RemixerSubPage[] => {
  if (!coverPageId) return book;
  return book.map((page) =>
    page["@id"] === coverPageId ? page : { ...page, article: "topic-guide" },
  );
};

// ---------------------------------------------------------------------------
// Matter node helpers
// ---------------------------------------------------------------------------

export const isMatterNode = (node: RemixerSubPage): boolean =>
  isFrontMatterNode(node) || isBackMatterNode(node);

export const isMatterBranchNode = (
  nodeId: string | undefined,
  book: RemixerSubPage[],
): boolean => {
  if (!nodeId) return false;
  const nodesById = new Map(book.map((node) => [node["@id"], node]));
  let currentId: string | undefined = nodeId;
  const visited = new Set<string>();
  while (currentId && currentId !== "-1" && !visited.has(currentId)) {
    visited.add(currentId);
    const node = nodesById.get(currentId);
    if (!node) return false;
    if (isMatterNode(node)) return true;
    currentId = node.parentID ?? "-1";
  }
  return false;
};

const isInMatterNoNumberSubtreeForAutonumber = (
  page: RemixerSubPage,
  nodesById: Map<string, RemixerSubPage>,
): boolean => {
  // Titles under front/back matter never show an autonumber prefix; path
  // ordinals for custom matter children are still computed separately.
  let id: string | undefined = page["@id"];
  const visited = new Set<string>();
  while (id && id !== "-1" && !visited.has(id)) {
    visited.add(id);
    const n = nodesById.get(id);
    if (!n) break;
    if (isMatterRootNode(n) || isMatterNode(n)) return true;
    id = n.parentID ?? "-1";
  }
  return false;
};

const isInDeletedBranchForAutonumber = (
  page: RemixerSubPage,
  nodesById: Map<string, RemixerSubPage>,
): boolean => {
  if (page.deletedItem === true || page.isDeleted === true) return true;
  let id: string | undefined = page.parentID ?? "-1";
  const visited = new Set<string>();
  while (id && id !== "-1" && !visited.has(id)) {
    visited.add(id);
    const n = nodesById.get(id);
    if (!n) break;
    if (n.deletedItem === true || n.isDeleted === true) return true;
    id = n.parentID ?? "-1";
  }
  return false;
};

/** True when override toggle or custom prefix differs from the loaded baseline. */
export const hasFormattedPathChanged = (page: RemixerSubPage): boolean => {
  // if it is matter default page, return false
  if (isDefaultMatterPage(page)) return false;
  if (isMatterRootNode(page)) return false;
  if (page.addedItem === true) return false;
  const currPath = (
    page.pathNumber ? page.pathNumber.join(".") : (page.numberedPath ?? "")
  ).trim();
  const url = getRemixerPageUriUi(page);
  // A URL-ending override replaces this page's path segment outright, so the
  // live URL is expected to diverge from the auto-numbered structural prefix
  // checked below — that drift is tracked separately by
  // hasOverrideUriEndingChanged, not here.
  if (!page.overrideUriUiEnding && url && currPath.length > 0) {
    const section = url.split("/").pop();
    const parts = currPath.split(".");
    parts[parts.length - 1] = parts[parts.length - 1]!.padStart(2, "0");
    const currPathWithSection = parts.join(".");
    const started = section?.startsWith(currPathWithSection);
    if (started === false) return true;
  }
  if (page.originalFormattedPathOverride === undefined) {
    return false;
  }

  const origOverride = page.originalFormattedPathOverride === true;
  const currOverride = page.formattedPathOverride === true;
  if (origOverride !== currOverride) return true;
  if (!currOverride) return false;
  // Both sides are the override *text*, not the structural ordinals. Comparing
  // originalPathNumber against pathNumber here would only restate the position
  // check `arePathNumbersEqual` already does for `movedItem`, and would miss the
  // thing this function exists to catch: the user editing the custom prefix
  // while the page stays put. `originalFormattedPath` is seeded from
  // `formattedPath` in `normalizeBookState`, so the two compare like for like.
  const origFormattedPath = stripObjectObjectMarker(
    page.originalFormattedPath,
  ).trim();
  const currFormattedPath = stripObjectObjectMarker(page.formattedPath).trim();

  return origFormattedPath !== currFormattedPath;
};

/**
 * True when the URL-ending override differs from the loaded baseline.
 * Independent of `autoNumbering` — unlike `hasFormattedPathChanged`, this must
 * fire regardless of whether numbering display is on, since it tracks a raw
 * path override rather than a numbering concern.
 */
export const hasOverrideUriEndingChanged = (page: RemixerSubPage): boolean => {
  if (isDefaultMatterPage(page)) return false;
  if (isMatterRootNode(page)) return false;
  if (page.addedItem === true) return false;
  return (
    (page.originalOverrideUriUiEnding ?? "") !==
    (page.overrideUriUiEnding ?? "")
  );
};

/**
 * When autonumbering is on, sets `renamedItem` if the stored title is not the canonical
 * autonumber display (`getRemixerDisplayTitle`). Custom-prefix pages with an unchanged
 * override are not listed as renames; changing the override toggle or prefix value is.
 * When autonumbering is off, `renamedItem` is unchanged.
 */
export const syncRenamedItemFromAutonumberTitle = (
  book: RemixerSubPage[],
  autoNumbering: boolean,
  pathLevelFormats: PathLevelFormat[],
): RemixerSubPage[] => {
  if (book.length === 0) return book;
  const nodesById = new Map(book.map((n) => [n["@id"], n]));
  const ordinalPathById = computeRemixerOrdinalPathsMap(book, pathLevelFormats);

  const displayOptions: GetRemixerDisplayTitleOptions = {
    isBookTree: true,
    autoNumbering,
    pathLevelFormats,
    remixerPathLookup: { nodesById, ordinalPathById },
  };

  return book.map((page) => {
    if (!autoNumbering) {
      return page;
    }

    if (hasFormattedPathChanged(page)) {
      return { ...page, renamedItem: true };
    }

    if (page.formattedPathOverride === true && page.renamedItem !== true) {
      return { ...page, renamedItem: false };
    }

    const numberPath = ordinalPathById.get(page["@id"]) ?? [];

    // Book root has no autonumber prefix — its title is authoritative as-is.
    // Leave renamedItem as whatever handleSaveEdit already set it to.
    if (numberPath.length === 0) return page;

    const inDeletedBranch = isInDeletedBranchForAutonumber(page, nodesById);
    const inMatterNoNumberSubtree = isInMatterNoNumberSubtreeForAutonumber(
      page,
      nodesById,
    );

    // Matter titles carry no autonumber prefix, so any title "matches" the
    // canonical display — deriving renamedItem from that would clear a real
    // rename set by handleSaveEdit. Keep whatever the edit recorded.
    if (inMatterNoNumberSubtree) return page;

    const expectedDisplay = getRemixerDisplayTitle(
      page,
      numberPath,
      inMatterNoNumberSubtree,
      inDeletedBranch,
      displayOptions,
    );

    const rawTitle = (page["@title"] || page.title || "").trim();

    const titleMatches = rawTitle === expectedDisplay.trim();
    return {
      ...page,
      renamedItem: !titleMatches,
    };
  });
};

// ---------------------------------------------------------------------------
// Book depth
// ---------------------------------------------------------------------------

export const computeHighestPathLevel = (book: RemixerSubPage[]): number => {
  if (!book || book.length === 0) return 0;
  const nodesById = new Map(book.map((page) => [page["@id"], page]));
  const depthById = new Map<string, number>();
  const visiting = new Set<string>();

  const computeDepth = (nodeId: string): number => {
    if (depthById.has(nodeId)) return depthById.get(nodeId) as number;
    if (visiting.has(nodeId)) return 0; // guard against cyclic refs
    visiting.add(nodeId);
    const node = nodesById.get(nodeId);
    if (!node) {
      visiting.delete(nodeId);
      return 0;
    }
    const parentId = node.parentID ?? "-1";
    const depth =
      parentId === "-1" || !nodesById.has(parentId)
        ? 0
        : computeDepth(parentId) + 1;
    visiting.delete(nodeId);
    depthById.set(nodeId, depth);
    return depth;
  };

  return Math.max(...book.map((page) => computeDepth(page["@id"])));
};

// ---------------------------------------------------------------------------
// Book mutation helpers (pure — return new arrays, no side effects)
// ---------------------------------------------------------------------------

export const applyBookNodeDeletion = (
  existingBookNodes: RemixerSubPage[],
  selectedNodeId: string,
): RemixerSubPage[] => {
  const childMap = new Map<string, string[]>();
  existingBookNodes.forEach((node) => {
    const parentId = node.parentID ?? "-1";
    const siblings = childMap.get(parentId) ?? [];
    siblings.push(node["@id"]);
    childMap.set(parentId, siblings);
  });

  const toDelete = new Set<string>();
  const queue: string[] = [selectedNodeId];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || toDelete.has(nodeId)) continue;
    toDelete.add(nodeId);
    (childMap.get(nodeId) ?? []).forEach((childId) => queue.push(childId));
  }

  // Draft nodes (client ids contain "-") were never published — drop each one
  // instead of soft-deleting it so it never appears in the publish delete set.
  // Decided per-node, not per-subtree: a subtree can mix draft and
  // already-published nodes, and a published sibling/descendant must not
  // stop an adjacent draft node from being dropped.
  const afterDeletion = existingBookNodes
    .filter((node) => !(toDelete.has(node["@id"]) && node["@id"].includes("-")))
    .map((node) => {
      if (!toDelete.has(node["@id"]) || node["@id"].includes("-")) return node;
      // The selected node is a direct delete. A descendant that's already
      // deleted was deleted independently before this action — leave its
      // own deletedItem/deletedViaAncestor state untouched so a later
      // restore of this ancestor doesn't resurrect it.
      if (node["@id"] === selectedNodeId) {
        return { ...node, deletedItem: true, deletedViaAncestor: false };
      }
      if (node.deletedItem === true) return node;
      return { ...node, deletedItem: true, deletedViaAncestor: true };
    });

  const activeChildrenByParent = new Set<string>();
  afterDeletion.forEach((node) => {
    if (!node.deletedItem && node.parentID) {
      activeChildrenByParent.add(node.parentID);
    }
  });

  return afterDeletion.map((node) =>
    !node.deletedItem
      ? { ...node, "@subpages": activeChildrenByParent.has(node["@id"]) }
      : node,
  );
};

/**
 * True when an ancestor of `nodeId` (not the node itself) is still deleted.
 * The server treats a page as deleted whenever any ancestor is deleted
 * (`inDeletedBranch`, independent of the page's own flag) and recursively
 * deletes the whole branch on publish — so restoring a node below a
 * still-deleted ancestor would look "active" locally but be silently
 * deleted again on the next publish. Callers should block restore in that
 * case rather than let it happen.
 */
export const isNodeUnderDeletedAncestor = (
  existingBookNodes: RemixerSubPage[],
  nodeId: string,
): boolean => {
  const nodesById = new Map(existingBookNodes.map((n) => [n["@id"], n]));
  let currentId = nodesById.get(nodeId)?.parentID ?? "-1";
  const visited = new Set<string>();
  while (currentId && currentId !== "-1" && !visited.has(currentId)) {
    visited.add(currentId);
    const ancestor = nodesById.get(currentId);
    if (!ancestor) break;
    if (ancestor.deletedItem === true) return true;
    currentId = ancestor.parentID ?? "-1";
  }
  return false;
};

/**
 * Inverse of `applyBookNodeDeletion` — clears `deletedItem` on the node and
 * its cascade-deleted descendants, but NOT on a descendant that was deleted
 * independently before this ancestor was (`deletedViaAncestor !== true`).
 * The BFS stops descending at such a node entirely: it and everything under
 * it stay deleted, matching how the server treats any node under a still-
 * deleted ancestor as deleted regardless of its own flag.
 */
export const applyBookNodeRestore = (
  existingBookNodes: RemixerSubPage[],
  selectedNodeId: string,
): RemixerSubPage[] => {
  const childMap = new Map<string, string[]>();
  const nodesById = new Map<string, RemixerSubPage>();
  existingBookNodes.forEach((node) => {
    nodesById.set(node["@id"], node);
    const parentId = node.parentID ?? "-1";
    const siblings = childMap.get(parentId) ?? [];
    siblings.push(node["@id"]);
    childMap.set(parentId, siblings);
  });

  const toRestore = new Set<string>();
  const queue: string[] = [selectedNodeId];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || toRestore.has(nodeId)) continue;
    const node = nodesById.get(nodeId);
    // Only an explicit `false` marks a descendant as deleted on its own. An
    // absent flag means the draft was saved before `deletedViaAncestor` existed,
    // where every node in a deleted subtree was flagged the same way and a
    // cascade is the only thing it could have been — so those come back.
    const isIndependentlyDeleted =
      nodeId !== selectedNodeId &&
      node?.deletedItem === true &&
      node.deletedViaAncestor === false;
    if (isIndependentlyDeleted) continue;
    toRestore.add(nodeId);
    (childMap.get(nodeId) ?? []).forEach((childId) => queue.push(childId));
  }

  const afterRestore = existingBookNodes.map((node) =>
    toRestore.has(node["@id"])
      ? { ...node, deletedItem: false, deletedViaAncestor: false }
      : node,
  );

  const activeChildrenByParent = new Set<string>();
  afterRestore.forEach((node) => {
    if (!node.deletedItem && node.parentID) {
      activeChildrenByParent.add(node.parentID);
    }
  });

  return afterRestore.map((node) =>
    !node.deletedItem
      ? { ...node, "@subpages": activeChildrenByParent.has(node["@id"]) }
      : node,
  );
};

const isDescendant = (
  nodeId: string,
  ancestorId: string,
  nodesById: Map<string, RemixerSubPage>,
): boolean => {
  let currentParentId = nodesById.get(nodeId)?.parentID ?? "-1";
  const visited = new Set<string>();
  while (
    currentParentId &&
    currentParentId !== "-1" &&
    !visited.has(currentParentId)
  ) {
    if (currentParentId === ancestorId) return true;
    visited.add(currentParentId);
    currentParentId = nodesById.get(currentParentId)?.parentID ?? "-1";
  }
  return false;
};

export const reorderBookNodes = ({
  existingBook,
  draggedNodeId,
  targetNodeId,
  position,
}: {
  existingBook: RemixerSubPage[];
  draggedNodeId: string;
  targetNodeId: string;
  position: DropPosition;
}): RemixerSubPage[] => {
  if (draggedNodeId === targetNodeId) return existingBook;
  const nodesById = new Map(existingBook.map((node) => [node["@id"], node]));
  const draggedNode = nodesById.get(draggedNodeId);
  const targetNode = nodesById.get(targetNodeId);
  if (!draggedNode || !targetNode) return existingBook;

  const targetParentId =
    position === "inside" ? targetNodeId : (targetNode.parentID ?? "-1");
  if (!targetParentId || targetParentId === draggedNodeId) return existingBook;
  if (isDescendant(targetParentId, draggedNodeId, nodesById))
    return existingBook;

  const withUpdatedParent = existingBook.map((node) =>
    node["@id"] === draggedNodeId
      ? { ...node, parentID: targetParentId }
      : node,
  );

  const siblingNodes = withUpdatedParent.filter(
    (node) => (node.parentID ?? "-1") === targetParentId,
  );
  const siblingMap = new Map(
    siblingNodes.map((siblingNode) => [siblingNode["@id"], siblingNode]),
  );
  const siblingIds = siblingNodes
    .map((siblingNode) => siblingNode["@id"])
    .filter((siblingId) => siblingId !== draggedNodeId);
  const targetIndex = siblingIds.indexOf(targetNodeId);
  const insertIndex =
    position === "before"
      ? Math.max(targetIndex, 0)
      : position === "after"
        ? targetIndex >= 0
          ? targetIndex + 1
          : siblingIds.length
        : siblingIds.length;

  const orderedSiblingIds = [...siblingIds];
  orderedSiblingIds.splice(insertIndex, 0, draggedNodeId);

  const orderedSiblings = orderedSiblingIds
    .map((siblingId) => siblingMap.get(siblingId))
    .filter(Boolean) as RemixerSubPage[];

  const reordered: RemixerSubPage[] = [];
  let insertedSiblings = false;
  withUpdatedParent.forEach((bookNode) => {
    if ((bookNode.parentID ?? "-1") === targetParentId) {
      if (!insertedSiblings) {
        reordered.push(...orderedSiblings);
        insertedSiblings = true;
      }
      return;
    }
    reordered.push(bookNode);
  });
  if (!insertedSiblings) {
    reordered.push(...orderedSiblings);
  }
  return reordered;
};

// ---------------------------------------------------------------------------
// Tree traversal helpers
// ---------------------------------------------------------------------------

/** Document-order rank for every descendant of `rootId` (root itself not ranked). */
export const buildPreorderRankMap = (
  nodes: RemixerSubPage[],
  rootId: string,
): Map<string, number> => {
  const childrenBy = new Map<string, RemixerSubPage[]>();
  for (const n of nodes) {
    const pid = n.parentID ?? "";
    if (!childrenBy.has(pid)) childrenBy.set(pid, []);
    childrenBy.get(pid)!.push(n);
  }
  const rank = new Map<string, number>();
  let seq = 0;
  const walk = (nid: string) => {
    if (nid !== rootId) rank.set(nid, seq++);
    for (const c of childrenBy.get(nid) ?? []) walk(c["@id"]);
  };
  walk(rootId);
  return rank;
};

/**
 * Depth of `nodeId` in `book`, counted from the nearest root (no `parentID`,
 * parentID "-1", or parent missing from the book). When `stopAtParentId` is
 * provided, the walk stops there and that node is treated as a root.
 */
export const computeNodeDepth = (
  book: RemixerSubPage[],
  nodeId: string,
  options: { stopAtParentId?: string } = {},
): number => {
  const { stopAtParentId } = options;
  const nodesById = new Map(book.map((n) => [n["@id"], n]));
  let depth = 0;
  let currentId: string | undefined = nodeId;
  while (currentId && currentId !== stopAtParentId && currentId !== "-1") {
    const node = nodesById.get(currentId);
    if (!node) break;
    depth += 1;
    currentId = node.parentID;
  }
  return depth;
};

/** Whether a book node is a root (no parent, parent "-1", or parent missing). */
export const isRootBookNode = (
  book: RemixerSubPage[],
  nodeId: string,
): boolean => {
  const node = book.find((n) => n["@id"] === nodeId);
  if (!node) return false;
  return !node.parentID || node.parentID === "-1";
};

// ---------------------------------------------------------------------------
// New-node title helpers
// ---------------------------------------------------------------------------

/** Name for a new node at `depth` below its parent (0 = root-level chapter). */
export const getNewNodeTitleForDepth = (depth: number): string => {
  if (depth <= 0) return "New Chapter";
  if (depth <= 1) return "New Page";
  return "New Subpage";
};

/** Label without the "New " prefix — for menu copy like "Add Chapter Above". */
export const getNodeTypeLabelForDepth = (depth: number): string =>
  getNewNodeTitleForDepth(depth).replace(/^New\s+/, "");

// ---------------------------------------------------------------------------
// Library / catalog classification
// ---------------------------------------------------------------------------

export const RESTRICTED_LIBRARY_SHELF_TITLES = [
  "bookshelves",
  "campus bookshelves",
];

export const getLibraryNodeTitle = (node: RemixerSubPage | undefined): string =>
  (node?.["@title"] || node?.title || "").trim().toLowerCase();

/** Shelves themselves and their immediate children can't be imported into a book. */
export const isRestrictedLibraryShelfNode = (
  pages: RemixerSubPage[],
  nodeId: string,
): boolean => {
  if (pages.length === 0) return false;
  const nodesById = new Map(pages.map((n) => [n["@id"], n]));
  const node = nodesById.get(nodeId);
  if (!node) return false;
  const title = getLibraryNodeTitle(node);
  if (RESTRICTED_LIBRARY_SHELF_TITLES.includes(title)) return true;
  const parent = node.parentID ? nodesById.get(node.parentID) : undefined;
  return RESTRICTED_LIBRARY_SHELF_TITLES.includes(getLibraryNodeTitle(parent));
};

/** A library node that matches a catalog entry's book page (library/id prefix). */
export const isBookLevelCatalogNode = (
  catalog: Book[] | undefined,
  library: string | undefined,
  nodeId: string,
): boolean => {
  if (!catalog || catalog.length === 0 || !nodeId) return false;
  return catalog.some((book) => {
    const parts = (book.bookID ?? "").split("-");
    const bookLib = parts[0];
    const bookPageId = parts[1];
    if (!bookPageId) return false;
    if (bookPageId !== nodeId) return false;
    if (library && bookLib && bookLib !== library) return false;
    return true;
  });
};

// ---------------------------------------------------------------------------
// Library subtree import (pure reducer)
// ---------------------------------------------------------------------------

export interface ComputeLibraryImportInsertionParams {
  existingBookNodes: RemixerSubPage[];
  subtreeNodes: RemixerSubPage[];
  originalRootId: string;
  targetNodeId: string;
  position: DropPosition;
  targetParentId: string;
  extractContent: boolean;
  /** Only used when `extractContent` is true. Defaults to all descendants. */
  selectedSourceIds?: Set<string>;
  /** Optional id suffix override — mostly for tests. */
  idSuffix?: string;
}

/**
 * Insert a library subtree into the current book. When `extractContent` is
 * true, copies only the selected descendants (or all descendants if no
 * selection), skipping the subtree root and re-parenting orphans to the
 * nearest selected ancestor (or `targetParentId`).
 */
export const computeLibraryImportInsertion = ({
  existingBookNodes,
  subtreeNodes,
  originalRootId,
  targetNodeId,
  position,
  targetParentId,
  extractContent,
  selectedSourceIds,
  idSuffix,
}: ComputeLibraryImportInsertionParams): RemixerSubPage[] => {
  const suffix =
    idSuffix ?? `-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (extractContent) {
    const allDescendantIds = new Set(
      subtreeNodes
        .filter((sn) => sn["@id"] !== originalRootId)
        .map((sn) => sn["@id"]),
    );
    const subtreeById = new Map(subtreeNodes.map((n) => [n["@id"], n]));
    const parentById = new Map<string, string | undefined>();
    subtreeNodes.forEach((n) => parentById.set(n["@id"], n.parentID));

    const idsToCopy = new Set<string>();
    if (selectedSourceIds && selectedSourceIds.size > 0) {
      selectedSourceIds.forEach((sid) => {
        if (sid !== originalRootId && allDescendantIds.has(sid)) {
          idsToCopy.add(sid);
        }
      });
    } else {
      allDescendantIds.forEach((id) => idsToCopy.add(id));
    }

    if (idsToCopy.size === 0) return existingBookNodes;

    const idMap = new Map<string, string>();
    for (const id of idsToCopy) idMap.set(id, `${id}${suffix}`);

    const resolveNewParentId = (sn: RemixerSubPage): string => {
      let p: string | undefined = sn.parentID;
      while (p) {
        if (p === originalRootId) return targetParentId;
        if (idsToCopy.has(p)) return idMap.get(p)!;
        p = parentById.get(p);
      }
      return targetParentId;
    };

    const copied: RemixerSubPage[] = [...idsToCopy].map((id) => {
      const sn = subtreeById.get(id)!;
      return {
        ...sn,
        sourceID: sn["@id"],
        "@id": idMap.get(sn["@id"])!,
        addedItem: true,
        parentID: resolveNewParentId(sn),
      };
    });

    const preorderRank = buildPreorderRankMap(subtreeNodes, originalRootId);
    const copiedSorted = [...copied].sort(
      (a, b) =>
        (preorderRank.get(a.sourceID!) ?? 0) -
        (preorderRank.get(b.sourceID!) ?? 0),
    );

    const rootsForReorder = copiedSorted.filter(
      (cn) => cn.parentID === targetParentId,
    );

    let nextBook = [...existingBookNodes, ...copiedSorted];

    if (position !== "inside" && rootsForReorder.length > 0) {
      const childIdsNew = rootsForReorder.map((c) => c["@id"]);
      childIdsNew.forEach((newId, index) => {
        const currentTarget =
          index === 0 ? targetNodeId : childIdsNew[index - 1];
        const currentPos: DropPosition = index === 0 ? position : "after";
        nextBook = insertAtSiblingPosition({
          bookNodes: nextBook,
          importedRootId: newId,
          targetNodeId: currentTarget,
          position: currentPos,
          targetParentId,
        });
      });
    }

    return nextBook;
  }

  const idMap = new Map<string, string>();
  for (const sn of subtreeNodes) {
    idMap.set(sn["@id"], `${sn["@id"]}${suffix}`);
  }

  const importedRootId = idMap.get(originalRootId)!;
  const copiedSubtreeNodes = subtreeNodes.map((subtreeNode) => ({
    ...subtreeNode,
    sourceID: subtreeNode["@id"],
    "@id": idMap.get(subtreeNode["@id"])!,
    addedItem: true,
    parentID:
      subtreeNode["@id"] === originalRootId
        ? targetParentId
        : (idMap.get(subtreeNode.parentID ?? "") ?? subtreeNode.parentID),
  }));

  const nextBookNodes = [...existingBookNodes, ...copiedSubtreeNodes];

  return insertAtSiblingPosition({
    bookNodes: nextBookNodes,
    importedRootId,
    targetNodeId,
    position,
    targetParentId,
  });
};

export const insertAtSiblingPosition = ({
  bookNodes,
  importedRootId,
  targetNodeId,
  position,
  targetParentId,
}: {
  bookNodes: RemixerSubPage[];
  importedRootId: string;
  targetNodeId: string;
  position: DropPosition;
  targetParentId: string;
}): RemixerSubPage[] => {
  if (position === "inside") return bookNodes;

  const siblingNodes = bookNodes.filter(
    (bookNode) => (bookNode.parentID ?? "-1") === targetParentId,
  );
  const siblingMap = new Map(
    siblingNodes.map((siblingNode) => [siblingNode["@id"], siblingNode]),
  );
  const siblingIds = siblingNodes
    .map((siblingNode) => siblingNode["@id"])
    .filter((siblingId) => siblingId !== importedRootId);
  const targetIndex = siblingIds.indexOf(targetNodeId);
  const insertIndex =
    position === "before"
      ? Math.max(targetIndex, 0)
      : targetIndex >= 0
        ? targetIndex + 1
        : siblingIds.length;

  const orderedSiblingIds = [...siblingIds];
  orderedSiblingIds.splice(insertIndex, 0, importedRootId);

  const orderedSiblings = orderedSiblingIds
    .map((siblingId) => siblingMap.get(siblingId))
    .filter(Boolean) as RemixerSubPage[];

  const reordered: RemixerSubPage[] = [];
  let insertedSiblings = false;
  bookNodes.forEach((bookNode) => {
    if ((bookNode.parentID ?? "-1") === targetParentId) {
      if (!insertedSiblings) {
        reordered.push(...orderedSiblings);
        insertedSiblings = true;
      }
      return;
    }
    reordered.push(bookNode);
  });
  if (!insertedSiblings) {
    reordered.push(...orderedSiblings);
  }
  return reordered;
};

export const isLibrary = (value: string): value is Library =>
  libraries.includes(value as Library);
