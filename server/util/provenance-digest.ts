import type { AffectedBook } from "./provenance-graph.js";

/**
 * Pure building blocks for the source-change emails: which lead hears about
 * which change, merged and worded. No I/O here; the notify service does the
 * lookups and sending.
 */

/** A queued source change, reduced to what the digest needs. */
export type DigestEvent = {
  eventID: string;
  sourcePage: string;
  fromRev?: number;
  toRev?: number;
  deleted: boolean;
  changedAt: Date;
  affected: AffectedBook[];
};

/** A Conductor project linked to an affected book. */
export type DigestProject = {
  projectID: string;
  title: string;
  /** Lead UUIDs. */
  leads: string[];
};

/**
 * What happened to a source, from the reader's side:
 * - `deleted`: the source is gone; live reuse of it now renders nothing.
 * - `changed`: the source was edited and the book already shows the edit.
 * - `out-of-date`: the source was edited but the book holds a copy of it.
 */
export type DigestLineStatus = "deleted" | "changed" | "out-of-date";

/** One source page's change, as one project sees it. */
export type DigestLine = {
  sourcePage: string;
  bookID: string;
  status: DigestLineStatus;
  /** Live reuse that a deletion broke vs. copies left without a source. */
  frozen: boolean;
  fromRev?: number;
  toRev?: number;
  pages: number;
  minHops: number;
  via: string[];
  examples: string[];
  changedAt: Date;
};

export type DigestSection = {
  projectID: string;
  title: string;
  lines: DigestLine[];
  /** Lines left out by the per-project cap. */
  more: number;
};

export type LeadDigest = {
  /** Lead UUID. */
  recipient: string;
  sections: DigestSection[];
  /** Every event the digest covers, including lines past the cap. */
  eventIDs: string[];
};

/** Lines per project before the rest collapse into "and N more". */
export const DIGEST_MAX_LINES_PER_PROJECT = 20;

const STATUS_ORDER: Record<DigestLineStatus, number> = {
  deleted: 0,
  changed: 1,
  "out-of-date": 2,
};

const minDefined = (a?: number, b?: number) =>
  a === undefined ? b : b === undefined ? a : Math.min(a, b);
const maxDefined = (a?: number, b?: number) =>
  a === undefined ? b : b === undefined ? a : Math.max(a, b);

/** Folds a second event for the same source and project into a line. */
const mergeLine = (line: DigestLine, event: DigestEvent, book: AffectedBook) => {
  line.fromRev = minDefined(line.fromRev, event.fromRev);
  line.toRev = maxDefined(line.toRev, event.toRev);
  if (event.deleted) {
    line.status = "deleted";
    line.frozen = book.frozen;
  } else if (line.status !== "deleted" && !book.frozen) {
    line.status = "changed";
  }
  line.pages = Math.max(line.pages, book.pages);
  if (book.minHops < line.minHops) {
    line.minHops = book.minHops;
    line.via = [...book.via];
  }
  for (const page of book.examples) {
    if (!line.examples.includes(page)) line.examples.push(page);
  }
  if (event.changedAt > line.changedAt) line.changedAt = event.changedAt;
};

/**
 * Turns queued events into one digest per lead: sections per project, one
 * line per source page however many revisions or events it took (lowest
 * `fromRev`, highest `toRev`, a deletion wins). Opted-out projects should be
 * left out of `projectsByBook` by the caller.
 */
export const buildLeadDigests = (
  events: DigestEvent[],
  projectsByBook: Map<string, DigestProject[]>,
  { maxLinesPerProject = DIGEST_MAX_LINES_PER_PROJECT } = {},
): LeadDigest[] => {
  type Acc = {
    project: DigestProject;
    lines: Map<string, DigestLine>;
    eventIDs: Set<string>;
  };
  const byProject = new Map<string, Acc>();

  const ordered = [...events].sort(
    (a, b) => a.changedAt.getTime() - b.changedAt.getTime(),
  );
  for (const event of ordered) {
    for (const book of event.affected) {
      for (const project of projectsByBook.get(book.bookID) ?? []) {
        let acc = byProject.get(project.projectID);
        if (!acc) {
          acc = { project, lines: new Map(), eventIDs: new Set() };
          byProject.set(project.projectID, acc);
        }
        acc.eventIDs.add(event.eventID);
        const existing = acc.lines.get(event.sourcePage);
        if (existing) {
          mergeLine(existing, event, book);
          continue;
        }
        acc.lines.set(event.sourcePage, {
          sourcePage: event.sourcePage,
          bookID: book.bookID,
          status: event.deleted ? "deleted" : book.frozen ? "out-of-date" : "changed",
          frozen: book.frozen,
          fromRev: event.fromRev,
          toRev: event.toRev,
          pages: book.pages,
          minHops: book.minHops,
          via: [...book.via],
          examples: [...book.examples],
          changedAt: event.changedAt,
        });
      }
    }
  }

  const byLead = new Map<string, { sections: DigestSection[]; eventIDs: Set<string> }>();
  const projects = [...byProject.values()].sort((a, b) =>
    a.project.title.localeCompare(b.project.title),
  );
  for (const { project, lines, eventIDs } of projects) {
    const sorted = [...lines.values()].sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        b.pages - a.pages ||
        a.sourcePage.localeCompare(b.sourcePage),
    );
    const section: DigestSection = {
      projectID: project.projectID,
      title: project.title,
      lines: sorted.slice(0, maxLinesPerProject),
      more: Math.max(0, sorted.length - maxLinesPerProject),
    };
    for (const lead of new Set(project.leads)) {
      let digest = byLead.get(lead);
      if (!digest) {
        digest = { sections: [], eventIDs: new Set() };
        byLead.set(lead, digest);
      }
      digest.sections.push(section);
      for (const id of eventIDs) digest.eventIDs.add(id);
    }
  }

  return [...byLead.entries()]
    .map(([recipient, { sections, eventIDs }]) => ({
      recipient,
      sections,
      eventIDs: [...eventIDs].sort(),
    }))
    .sort((a, b) => a.recipient.localeCompare(b.recipient));
};

/** Title and link of a page named in an email. */
export type DigestPageRef = { title: string; url: string };

/** A digest line ready for the mail template: plain text, no markup. */
export type DigestItem = {
  urgent: boolean;
  /** Short label, e.g. "Source deleted". */
  label: string;
  source: DigestPageRef;
  summary: string;
  /** Pages the change travels through before reaching the book (chains). */
  through: DigestPageRef[];
  /** Some of the book's affected pages. */
  pages: DigestPageRef[];
  /** Affected pages beyond `pages`. */
  morePages: number;
};

export type DigestEmailSection = {
  projectID: string;
  title: string;
  items: DigestItem[];
  more: number;
};

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

const revisionText = (line: DigestLine) =>
  line.fromRev !== undefined && line.toRev !== undefined
    ? ` (revision ${line.fromRev} → ${line.toRev})`
    : "";

/** The wording of one line. `resolve` names and links a page nodeID. */
export const describeDigestLine = (
  line: DigestLine,
  resolve: (nodeID: string) => DigestPageRef,
): DigestItem => {
  const one = line.pages === 1;
  const pages = `${plural(line.pages, "page")} in your book ${one ? "is" : "are"}`;
  const reuse = `${plural(line.pages, "page")} in your book ${one ? "reuses" : "reuse"} it`;
  let label: string;
  let summary: string;
  if (line.status === "deleted") {
    label = line.frozen ? "Source deleted" : "Source deleted: content missing";
    summary = line.frozen
      ? `This page was deleted. ${pages} copied from it and ${one ? "keeps its" : "keep their"} content, but no longer ${one ? "has" : "have"} a source to compare against.`
      : `This page was deleted. ${reuse} and now ${one ? "shows" : "show"} nothing where its content was. Replace or remove the reuse.`;
  } else if (line.status === "out-of-date") {
    label = "Copy may be out of date";
    summary = `This page was edited${revisionText(line)}. ${pages} ${one ? "a copy" : "copies"} of it and ${one ? "does" : "do"} not update on ${one ? "its" : "their"} own. Check whether ${one ? "it needs" : "they need"} the change.`;
  } else {
    label = "Source edited";
    summary = `This page was edited${revisionText(line)}. ${reuse} and already ${one ? "shows" : "show"} the new content. Review ${one ? "it" : "them"}.`;
  }
  const examples = line.examples.slice(0, line.pages);
  return {
    urgent: line.status === "deleted" && !line.frozen,
    label,
    source: resolve(line.sourcePage),
    summary,
    through: line.minHops > 1 ? line.via.map(resolve) : [],
    pages: examples.map(resolve),
    morePages: Math.max(0, line.pages - examples.length),
  };
};

/** A digest's sections worded for the mail template. */
export const describeDigest = (
  digest: LeadDigest,
  resolve: (nodeID: string) => DigestPageRef,
): DigestEmailSection[] =>
  digest.sections.map((section) => ({
    projectID: section.projectID,
    title: section.title,
    items: section.lines.map((line) => describeDigestLine(line, resolve)),
    more: section.more,
  }));
