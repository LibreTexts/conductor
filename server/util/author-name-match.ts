/**
 * Fuzzy comparison of people's names, used to ask "is this the same person?" before a
 * duplicate Author is created. Advisory only: it errs towards flagging, since the admin
 * makes the final call.
 */

/** Honorifics and degrees that say nothing about who someone is. */
const TITLE_TOKENS = new Set([
  "dr",
  "prof",
  "professor",
  "mr",
  "mrs",
  "ms",
  "mx",
  "phd",
  "md",
  "dds",
  "esq",
]);

/** Generational suffixes. These distinguish people, so they're kept and compared. */
const SUFFIX_TOKENS = new Set(["jr", "sr", "ii", "iii", "iv"]);

type ParsedName = {
  /** The normalised name, suffix included. */
  full: string;
  /** The name without its generational suffix. */
  core: string;
  first: string;
  last: string;
  suffix: string;
};

/** "Dr. Jane Q. Doe" -> "jane q doe"; "Doe, Jane" -> "jane doe". */
export function normalizeName(name: string): string {
  let n = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

  // "Last, First" -> "First Last". Left alone when the part after the comma is just a suffix
  // ("John Smith, Jr.") or there are several commas.
  const parts = n.split(",");
  if (
    parts.length === 2 &&
    parts[0].trim() &&
    parts[1].trim() &&
    !SUFFIX_TOKENS.has(parts[1].replace(/[^a-z]/g, ""))
  ) {
    n = `${parts[1].trim()} ${parts[0].trim()}`;
  }

  return n
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t && !TITLE_TOKENS.has(t))
    .join(" ");
}

function parseName(name: string): ParsedName {
  const tokens = normalizeName(name).split(" ").filter(Boolean);
  const last = tokens[tokens.length - 1] ?? "";
  const hasSuffix = tokens.length > 1 && SUFFIX_TOKENS.has(last);
  const suffix = hasSuffix ? last : "";
  const core = hasSuffix ? tokens.slice(0, -1) : tokens;

  return {
    full: tokens.join(" "),
    core: core.join(" "),
    first: core[0] ?? "",
    last: core[core.length - 1] ?? "",
    suffix,
  };
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    for (let j = 1; j <= b.length; j += 1) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * How likely two names are the same person, from 0 (no) to 1 (identical once normalised):
 * - 1.0 identical after normalising ("Jane Doe" / "doe, jane" / "Dr. Jane Doe"),
 * - 0.9 same surname and first name, middle names or initials ignored ("Jane Q. Doe"),
 * - 0.8 same surname and the first name is an initial that matches ("J. Doe"),
 * - 0.7 a couple of typos apart ("Jane Dow").
 * Names with different generational suffixes ("John Smith Jr." / "John Smith") never match.
 */
export function scoreNames(a: string, b: string): number {
  const pa = parseName(a);
  const pb = parseName(b);

  if (!pa.full || !pb.full) return 0;
  if (pa.full === pb.full) return 1;
  if (pa.suffix !== pb.suffix) return 0;

  const bothMultiWord = pa.core.includes(" ") && pb.core.includes(" ");
  let score = 0;

  if (bothMultiWord && pa.last === pb.last) {
    if (pa.first === pb.first) {
      score = 0.9;
    } else if (
      (pa.first.length === 1 || pb.first.length === 1) &&
      pa.first[0] === pb.first[0]
    ) {
      score = 0.8;
    }
  }

  if (
    score < 0.7 &&
    bothMultiWord &&
    Math.min(pa.core.length, pb.core.length) >= 6 &&
    editDistance(pa.core, pb.core) <= 2
  ) {
    score = 0.7;
  }

  return score;
}
