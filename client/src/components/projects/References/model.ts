type ReferenceFormatType =
  | "APA"
  | "MLA"
  | "Chicago"
  | "Harvard"
  | "Vancouver"
  | "AMA"
  | "IEEE"
  | "CSM"
  | "ASN"
  | "ANSI";
export type { ReferenceFormatType };
export const ReferenceFormatTypes: ReferenceFormatType[] = [
  "APA",
  "MLA",
  "Chicago",
  "Harvard",
  "Vancouver",
  "AMA",
  "IEEE",
  "CSM",
  "ASN",
  "ANSI",
];

export type SelectedReference = {
  referenceID: string;
  citationKey: string;
} ;



/** Where generated references are shown in the book. */
export type ReferenceDisplayLocation =
  | "endOfPage"
  | "endOfChapter"
  | "backmatter";

export const ReferenceDisplayLocations: {
  value: ReferenceDisplayLocation;
  label: string;
}[] = [
  { value: "endOfPage", label: "End of page" },
  { value: "endOfChapter", label: "Reference page at chapter level" },
  { value: "backmatter", label: "Reference page in backmatter" },
];

/**
 * Reference scope: the same model as the glossary scope. Pages are grouped,
 * and each group's combined reference list is shown on its target page.
 */
export type ReferenceScopeMode = "PAGE" | "CHAPTER" | "BACKMATTER";

export type ReferenceScopeGroup = {
  groupID: string;
  pageIds: string[];
  /** The page this group's combined reference list is displayed on. */
  targetPageId: string;
};

/**
 * Target of the BACKMATTER group before the shared back-matter References
 * page exists (the populate job creates it). Mirrors the server constant.
 */
export const REFERENCE_BACKMATTER_TARGET = "backmatter";

/** The scope mode an older, scope-less saved `displayLocation` stands for. */
export const scopeModeForDisplayLocation = (
  location: ReferenceDisplayLocation | undefined,
): ReferenceScopeMode =>
  location === "endOfChapter"
    ? "CHAPTER"
    : location === "backmatter"
      ? "BACKMATTER"
      : "PAGE";

export type BookReferencesData = {
  format: ReferenceFormatType | undefined;
  displayLocation?: ReferenceDisplayLocation;
  /** Page title when displayLocation is endOfChapter or backmatter. */
  pageTitle?: string;
  selectedList?: string[];
  /** Id of the shared back-matter References page, once populate made it. */
  backmatterPageID?: string;
  /** Saved scope; absent until one is saved (or after a reset). */
  scopeMode?: ReferenceScopeMode;
  scopeGroups?: ReferenceScopeGroup[];
  entries?: ReferenceEntry[];
};

/** Supported BibTeX entry kinds. */
export type EntryType =
  | "article"
  | "inproceedings"
  | "book"
  | "incollection"
  | "mastersthesis"
  | "phdthesis"
  | "misc";

export const EntryTypes: { value: EntryType; label: string }[] = [
  { value: "article", label: "Article" },
  { value: "inproceedings", label: "Conference paper" },
  { value: "book", label: "Book" },
  { value: "incollection", label: "Book chapter" },
  { value: "mastersthesis", label: "Master's thesis" },
  { value: "phdthesis", label: "PhD thesis" },
  { value: "misc", label: "Misc / website" },
];

export type ReferenceFieldKey =
  | "citationKey"
  | "author"
  | "title"
  | "journal"
  | "booktitle"
  | "year"
  | "volume"
  | "number"
  | "pages"
  | "doi"
  | "url"
  | "month"
  | "note"
  | "publisher"
  | "address"
  | "edition"
  | "isbn"
  | "editor"
  | "chapter"
  | "school"
  | "type"
  | "urldate";

/** A saved bibliographic reference returned by the project references API. */
export type ReferenceEntry = {
  referenceID: string;
  citationKey: string;
  entryType: EntryType;
  projectID?: string;
} & Partial<Omit<Record<ReferenceFieldKey, string>, "citationKey">>;

export type ReferenceFormData = Partial<Record<ReferenceFieldKey, string>> & {
  entryType: EntryType;
  citationKey: string;
};

const FIELD_LABELS: Record<ReferenceFieldKey, string> = {
  citationKey: "Citation key",
  author: "Author(s)",
  title: "Title",
  journal: "Journal",
  booktitle: "Book / proceedings title",
  year: "Year",
  volume: "Volume",
  number: "Number",
  pages: "Pages",
  doi: "DOI",
  url: "URL",
  month: "Month",
  note: "Note",
  publisher: "Publisher",
  address: "Address",
  edition: "Edition",
  isbn: "ISBN",
  editor: "Editor(s)",
  chapter: "Chapter",
  school: "School / university",
  type: "Type",
  urldate: "URL date (accessed)",
};

/** Fields shown (and serialized) for each entry type, in display order. */
export const BIBTEX_FIELDS_BY_TYPE: Record<EntryType, ReferenceFieldKey[]> = {
  article: [
    "citationKey",
    "author",
    "title",
    "journal",
    "year",
    "volume",
    "number",
    "pages",
    "doi",
    "url",
    "month",
    "note",
  ],
  inproceedings: [
    "citationKey",
    "author",
    "title",
    "booktitle",
    "year",
    "pages",
    "publisher",
    "address",
    "doi",
  ],
  book: [
    "citationKey",
    "author",
    "title",
    "publisher",
    "year",
    "edition",
    "address",
    "isbn",
  ],
  incollection: [
    "citationKey",
    "author",
    "title",
    "booktitle",
    "editor",
    "publisher",
    "year",
    "pages",
    "chapter",
  ],
  mastersthesis: [
    "citationKey",
    "author",
    "title",
    "school",
    "year",
    "address",
    "type",
  ],
  phdthesis: ["citationKey", "author", "title", "school", "year", "address"],
  misc: [
    "citationKey",
    "author",
    "title",
    "year",
    "month",
    "publisher",
    "url",
    "urldate",
    "note",
  ],
};

export function getBibtexFieldLabel(key: ReferenceFieldKey): string {
  return FIELD_LABELS[key];
}

export function emptyReferenceForm(
  entryType: EntryType = "article",
): ReferenceFormData {
  return { entryType, citationKey: "" };
}

function sanitizeCitationKeyPart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
}

function firstAuthorLastName(author: string): string {
  const first = author.split(/\s+and\s+/i)[0]?.trim() ?? "";
  if (!first) return "";
  if (first.includes(",")) {
    return first.split(",")[0]?.trim() ?? "";
  }
  const parts = first.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

const TITLE_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "in",
  "on",
  "for",
  "to",
  "with",
]);

function firstTitleWord(title: string): string {
  const words = title
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);
  const meaningful = words.find((w) => !TITLE_STOP_WORDS.has(w.toLowerCase()));
  return meaningful ?? words[0] ?? "";
}

/**
 * Build a BibTeX citation key from filled fields when the user left key blank.
 * Prefer `AuthorYearTitle` (e.g. `Smith2026First`). When `takenKeys` is given,
 * a letter is appended until the key is free (`Smith2026Firsta`, `…b`), the
 * same rule the server uses, so a generated key never collides.
 */
export function generateCitationKey(
  form: ReferenceFormData,
  takenKeys?: Iterable<string>,
): string {
  const author = sanitizeCitationKeyPart(
    firstAuthorLastName(form.author?.trim() ?? ""),
  );
  const year = (form.year?.trim() ?? "").match(/\d{4}/)?.[0] ?? "";
  const title = sanitizeCitationKeyPart(
    firstTitleWord(form.title?.trim() ?? ""),
  );
  const base = `${author}${year}${title}` || "untitled";
  const taken = new Set(takenKeys ?? []);
  if (!taken.has(base)) return base;
  for (let code = 97; code <= 122; code += 1) {
    const candidate = `${base}${String.fromCharCode(code)}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

const VALID_ENTRY_TYPES = new Set<string>(
  EntryTypes.map((t) => t.value),
);

/** Extract a `{...}` value with nested braces starting at `start` (`s[start] === '{'`). */
function extractBalancedBraces(
  s: string,
  start: number,
): { value: string; end: number } | null {
  if (s[start] !== "{") return null;
  let depth = 0;
  for (let i = start; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return { value: s.slice(start + 1, i), end: i + 1 };
      }
    }
  }
  return null;
}

/** Unwrap BibTeX case-protection braces: `{First}` → `First`. */
function unwrapBibtexBraces(value: string): string {
  let prev = "";
  let next = value;
  while (prev !== next) {
    prev = next;
    next = next.replace(/\{([^{}]*)\}/g, "$1");
  }
  return next.trim();
}

/**
 * Parse field assignments from a BibTeX entry body.
 * Supports nested braces, quoted strings, and bare numbers.
 */
function parseBibtexFields(
  body: string,
): Partial<Record<ReferenceFieldKey, string>> {
  const fields: Partial<Record<ReferenceFieldKey, string>> = {};
  let i = 0;
  while (i < body.length) {
    const keyMatch = body.slice(i).match(/^[\s,]*(\w+)\s*=\s*/);
    if (!keyMatch) {
      i += 1;
      continue;
    }
    i += keyMatch[0].length;
    const key = keyMatch[1].toLowerCase() as ReferenceFieldKey;
    let value = "";

    if (body[i] === "{") {
      const extracted = extractBalancedBraces(body, i);
      if (!extracted) break;
      value = unwrapBibtexBraces(extracted.value);
      i = extracted.end;
    } else if (body[i] === '"') {
      const end = body.indexOf('"', i + 1);
      if (end === -1) break;
      value = unwrapBibtexBraces(body.slice(i + 1, end));
      i = end + 1;
    } else {
      const numMatch = body.slice(i).match(/^(\d+)/);
      if (!numMatch) {
        i += 1;
        continue;
      }
      value = numMatch[1];
      i += numMatch[1].length;
    }

    if (key !== "citationKey") {
      fields[key] = value;
    }
  }
  return fields;
}

/** Parse the first BibTeX entry found in raw text into form data. */
export function parseBibtexToForm(raw: string): ReferenceFormData | null {
  const header = raw.match(/@(\w+)\s*\{\s*([^,\s}]+)\s*,/);
  if (!header || header.index === undefined) return null;

  const entryTypeRaw = header[1].toLowerCase();
  const entryType = (
    VALID_ENTRY_TYPES.has(entryTypeRaw) ? entryTypeRaw : "misc"
  ) as EntryType;
  const citationKey = header[2].trim();

  // Find the matching closing brace of the entry, then take fields after the key.
  const openBrace = raw.indexOf("{", header.index);
  if (openBrace === -1) return null;
  const entryClose = extractBalancedBraces(raw, openBrace);
  if (!entryClose) return null;
  // entryClose.value is `citationKey, fields...`
  const comma = entryClose.value.indexOf(",");
  const body =
    comma === -1 ? "" : entryClose.value.slice(comma + 1);

  const fields = parseBibtexFields(body);
  return { entryType, citationKey, ...fields };
}

/** Serialize form data back to a BibTeX entry string. */
export function formToBibtex(form: ReferenceFormData): string {
  const keys = BIBTEX_FIELDS_BY_TYPE[form.entryType].filter(
    (k) => k !== "citationKey",
  );
  const lines = keys
    .map((key) => {
      const value = form[key]?.trim();
      if (!value) return null;
      return `  ${key} = {${value}}`;
    })
    .filter(Boolean);

  const key = form.citationKey.trim() || generateCitationKey(form);
  return `@${form.entryType}{${key},\n${lines.join(",\n")}\n}`;
}

function field(form: ReferenceFormData, key: ReferenceFieldKey): string {
  return form[key]?.trim() ?? "";
}

function joinParts(parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

/** Rough author formatting: "First Last and A B" → APA-ish "Last, F., & B, A." when possible. */
function formatAuthorsApa(author: string): string {
  if (!author) return "";
  const names = author.split(/\s+and\s+/i).map((n) => n.trim()).filter(Boolean);
  return names
    .map((name, i) => {
      const parts = name.split(/\s+/);
      if (parts.length === 1) return parts[0];
      const last = parts[parts.length - 1];
      const initials = parts
        .slice(0, -1)
        .map((p) => `${p[0]?.toUpperCase()}.`)
        .join(" ");
      const formatted = `${last}, ${initials}`;
      if (names.length > 1 && i === names.length - 1) return `& ${formatted}`;
      return formatted;
    })
    .join(", ");
}

function formatAuthorsMla(author: string): string {
  if (!author) return "";
  const names = author.split(/\s+and\s+/i).map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return "";
  const firstParts = names[0].split(/\s+/);
  const firstFormatted =
    firstParts.length === 1
      ? firstParts[0]
      : `${firstParts[firstParts.length - 1]}, ${firstParts.slice(0, -1).join(" ")}`;
  if (names.length === 1) return firstFormatted;
  if (names.length === 2) return `${firstFormatted}, and ${names[1]}`;
  return `${firstFormatted}, et al.`;
}

/**
 * Builds a human-readable citation preview for the selected book reference format.
 * Approximate style guides for UI preview only (not a full CSL engine).
 */
export function formatCitationPreview(
  form: ReferenceFormData,
  format?: ReferenceFormatType,
): string {
  const author = field(form, "author");
  const title = field(form, "title");
  const year = field(form, "year");
  const journal = field(form, "journal");
  const booktitle = field(form, "booktitle");
  const publisher = field(form, "publisher");
  const pages = field(form, "pages");
  const volume = field(form, "volume");
  const number = field(form, "number");
  const doi = field(form, "doi");
  const url = field(form, "url");
  const school = field(form, "school");
  const address = field(form, "address");
  const edition = field(form, "edition");
  const editor = field(form, "editor");
  const chapter = field(form, "chapter");
  const isbn = field(form, "isbn");
  const note = field(form, "note");
  const urldate = field(form, "urldate");

  if (!author && !title) return "";

  const style = format ?? "APA";

  if (style === "MLA") {
    const a = formatAuthorsMla(author);
    if (form.entryType === "article") {
      return joinParts([
        a && `${a}.`,
        title && `“${title}.”`,
        journal && `${journal},`,
        volume && `vol. ${volume},`,
        number && `no. ${number},`,
        year && `${year},`,
        pages && `pp. ${pages}.`,
      ]);
    }
    return joinParts([
      a && `${a}.`,
      title && `“${title}.”`,
      booktitle && `${booktitle}.`,
      publisher && `${publisher},`,
      year && `${year}.`,
      pages && `pp. ${pages}.`,
      url && `${url}.`,
    ]);
  }

  if (style === "Chicago") {
    const a = formatAuthorsMla(author);
    return joinParts([
      a && `${a}.`,
      title && `“${title}.”`,
      journal && `${journal}`,
      volume && `${volume}`,
      number && `(no. ${number})`,
      year && `(${year}):`,
      pages && `${pages}.`,
      booktitle && `In ${booktitle}.`,
      publisher && `${publisher}.`,
      doi && `https://doi.org/${doi}.`,
      !doi && url && `${url}.`,
    ]);
  }

  if (style === "Harvard") {
    const a = formatAuthorsApa(author).replace(/&/g, "and");
    return joinParts([
      a,
      year && `(${year})`,
      title && `'${title}',`,
      journal && `${journal},`,
      volume,
      number && `(${number}),`,
      pages && `pp. ${pages}.`,
      publisher && `${publisher}.`,
      school && `${school}.`,
      url && `Available at: ${url}`,
      urldate && `(Accessed: ${urldate}).`,
    ]);
  }

  if (style === "Vancouver" || style === "AMA" || style === "IEEE") {
    const a = author.replace(/\s+and\s+/gi, ", ");
    return joinParts([
      a && `${a}.`,
      title && `${title}.`,
      journal && `${journal}.`,
      booktitle && `${booktitle}.`,
      year && `${year};`,
      volume,
      number && `(${number}):`,
      pages && `${pages}.`,
      publisher && `${publisher};`,
      school && `${school}.`,
      doi && `doi:${doi}`,
      url,
    ]);
  }

  // APA and related (CSM, ASN, ANSI) — APA-like preview
  const a = formatAuthorsApa(author);
  if (form.entryType === "article") {
    return joinParts([
      a,
      year && `(${year}).`,
      title && `${title}.`,
      journal && `${journal},`,
      volume,
      number && `(${number}),`,
      pages && `${pages}.`,
      doi && `https://doi.org/${doi}`,
      !doi && url,
    ]);
  }
  if (form.entryType === "book") {
    return joinParts([
      a,
      year && `(${year}).`,
      title && `${title}`,
      edition && `(${edition} ed.).`,
      address && `${address}:`,
      publisher && `${publisher}.`,
      isbn && `ISBN ${isbn}.`,
    ]);
  }
  if (form.entryType === "inproceedings" || form.entryType === "incollection") {
    return joinParts([
      a,
      year && `(${year}).`,
      title && `${title}.`,
      editor && `In ${editor} (Ed.),`,
      booktitle && `${booktitle}`,
      chapter && `(Chapter ${chapter})`,
      pages && `(pp. ${pages}).`,
      publisher && `${publisher}.`,
    ]);
  }
  if (form.entryType === "mastersthesis" || form.entryType === "phdthesis") {
    return joinParts([
      a,
      year && `(${year}).`,
      title && `${title}`,
      form.entryType === "phdthesis"
        ? "[Doctoral dissertation]."
        : "[Master's thesis].",
      school && `${school}.`,
      address && `${address}.`,
    ]);
  }
  return joinParts([
    a,
    year && `(${year}).`,
    title && `${title}.`,
    note && `${note}.`,
    url,
    urldate && `(Accessed ${urldate}).`,
  ]);
}


export type BookSearchProps = {
  searchQuery: string;
  self:boolean;
};
export const defaultBookSearchProps: BookSearchProps = {
  searchQuery: "",
  self: false,
};

export const bibScript = "{{template.ReferenceBib()}}";
export const referenceScript = "{{template.ReferenceCite()}}";