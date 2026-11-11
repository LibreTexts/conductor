import { Types } from "mongoose";
import { childLogger } from "../../logger.js";
import mailAPI from "../mail.js";
import Project from "../../models/project.js";
import User from "../../models/user.js";
import PageNode from "../../models/pagenode.js";
import PageReuseEdge from "../../models/pagereuseedge.js";
import SourceChangeEvent, {
  type SourceChangeEventInterface,
} from "../../models/sourcechangeevent.js";
import ProvenanceNotificationLog from "../../models/provenancenotificationlog.js";
import { getLibraryAndPageFromBookID } from "../../util/bookutils.js";
import { parsePageNodeId } from "../../util/provenance-graph.js";
import {
  buildLeadDigests,
  describeDigest,
  type DigestEmailSection,
  type DigestEvent,
  type DigestPageRef,
  type DigestProject,
  type LeadDigest,
} from "../../util/provenance-digest.js";

/**
 * Turns queued source-change events into one email per project lead.
 *
 * Safe to re-run and to run on two instances at once: every (event, lead)
 * pair is claimed in `provenancenotificationlogs` before its email is sent,
 * so a lead hears about a change at most once. An event is marked notified
 * only when every lead it reaches has been emailed; a failed send releases
 * its claim and the next run retries it.
 */

const notifyLog = childLogger("provenance-notify");

/** Oldest unsent events handled per run. */
const MAX_EVENTS_PER_RUN = 1000;
/**
 * A claim with no `sentAt` older than this was left by a run that died
 * between claiming and sending; it is released so the email goes out.
 * Far longer than any send takes, so a live run's claim is never stolen.
 */
const STALE_CLAIM_MS = 30 * 60 * 1000;

/** Claims that still count: sent, or claimed recently by a run that may be sending. */
const liveClaimFilter = () => ({
  $or: [
    { sentAt: { $ne: null } },
    { claimedAt: { $gt: new Date(Date.now() - STALE_CLAIM_MS) } },
  ],
});
const OR_QUERY_CHUNK = 200;

type EventRow = SourceChangeEventInterface & { _id: Types.ObjectId };
type ProjectRow = {
  projectID: string;
  title: string;
  leads?: string[];
  libreLibrary?: string;
  libreCoverID?: string;
};
type UserRow = { uuid: string; email?: string; firstName?: string };

export type NotifyOptions = {
  /** Build the digests and return them; send nothing, change nothing. */
  dryRun?: boolean;
  maxEvents?: number;
};

export type PreparedDigest = {
  recipient: string;
  email: string;
  name: string;
  eventIDs: string[];
  sections: DigestEmailSection[];
};

export type NotifyOutcome = {
  events: number;
  digests: number;
  sent: number;
  failed: number;
  /** Leads with no Conductor user or email address. */
  unreachable: number;
  eventsCompleted: number;
  edgesReset: number;
  /** Only on a dry run. */
  preview?: PreparedDigest[];
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/** Projects linked to each affected book, without those that opted out. */
const loadProjectsByBook = async (
  bookIDs: string[],
): Promise<Map<string, DigestProject[]>> => {
  const byBook = new Map<string, DigestProject[]>();
  const keys = bookIDs
    .map((bookID) => {
      const [lib, coverID] = getLibraryAndPageFromBookID(bookID) as [string?, string?];
      return lib && coverID ? { libreLibrary: lib, libreCoverID: coverID } : null;
    })
    .filter((key): key is { libreLibrary: string; libreCoverID: string } => key !== null);

  for (const batch of chunk(keys, OR_QUERY_CHUNK)) {
    const rows = await Project.find(
      { $or: batch, notifySourceChanges: { $ne: false } },
      { _id: 0, projectID: 1, title: 1, leads: 1, libreLibrary: 1, libreCoverID: 1 },
    ).lean<ProjectRow[]>();
    for (const row of rows) {
      if (!row.leads?.length) continue;
      const bookID = `${row.libreLibrary}-${row.libreCoverID}`;
      const list = byBook.get(bookID) ?? [];
      list.push({ projectID: row.projectID, title: row.title, leads: row.leads });
      byBook.set(bookID, list);
    }
  }
  return byBook;
};

/** Titles and links for every page the digests name. */
const loadPageRefs = async (
  digests: LeadDigest[],
): Promise<(nodeID: string) => DigestPageRef> => {
  const ids = new Set<string>();
  for (const digest of digests) {
    for (const section of digest.sections) {
      for (const line of section.lines) {
        ids.add(line.sourcePage);
        line.via.forEach((id) => ids.add(id));
        line.examples.forEach((id) => ids.add(id));
      }
    }
  }
  const titles = new Map<string, string>();
  for (const batch of chunk([...ids], 1000)) {
    const rows = await PageNode.find(
      { nodeID: { $in: batch } },
      { _id: 0, nodeID: 1, title: 1 },
    ).lean<{ nodeID: string; title?: string }[]>();
    for (const row of rows) if (row.title) titles.set(row.nodeID, row.title);
  }
  return (nodeID) => {
    const parts = parsePageNodeId(nodeID);
    return {
      title: titles.get(nodeID) ?? nodeID,
      // `@go/page` resolves by id, so the link survives renames and moves.
      url: parts
        ? `https://${parts.lib}.libretexts.org/@go/page/${parts.pageID}`
        : `https://libretexts.org`,
    };
  };
};

const toDigestEvent = (row: EventRow): DigestEvent => ({
  eventID: String(row._id),
  sourcePage: row.sourcePage,
  fromRev: row.fromRev,
  toRev: row.toRev,
  deleted: row.deleted,
  changedAt: row.changedAt,
  // A book whose project already reviewed the change needs no email about it.
  affected: (row.affected ?? [])
    .filter((book) => !book.reviewedAt)
    .map((book) => ({
      ...book,
      via: book.via ?? [],
      examples: book.examples ?? [],
    })),
});

/**
 * Claims (event, lead) pairs for this run. Returns the events claimed; a pair
 * another run already holds is left to it.
 */
const claimEvents = async (
  recipient: string,
  eventIDs: string[],
  projectIDs: string[],
): Promise<Set<string>> => {
  if (eventIDs.length === 0) return new Set();
  const claimedAt = new Date();
  // Release this lead's stale claims first, so the upsert below can take them.
  await ProvenanceNotificationLog.deleteMany({
    eventID: { $in: eventIDs.map((id) => new Types.ObjectId(id)) },
    recipient: { $eq: recipient },
    sentAt: null,
    claimedAt: { $lte: new Date(Date.now() - STALE_CLAIM_MS) },
  });
  const ops = eventIDs.map((id) => {
    const eventID = new Types.ObjectId(id);
    return {
      updateOne: {
        filter: { eventID, recipient },
        update: { $setOnInsert: { eventID, recipient, projectIDs, claimedAt, sentAt: null } },
        upsert: true,
      },
    };
  });
  let upserted: Record<string, unknown> = {};
  try {
    const res = await ProvenanceNotificationLog.bulkWrite(ops, { ordered: false });
    upserted = res.upsertedIds ?? {};
  } catch (err) {
    // A concurrent run claimed some pairs first (duplicate key); keep ours.
    const partial = (err as { result?: { upsertedIds?: Record<string, unknown> } })?.result;
    if (!partial?.upsertedIds) throw err;
    upserted = partial.upsertedIds;
  }
  return new Set(Object.keys(upserted).map((index) => eventIDs[Number(index)]));
};

let notifyRunning = false;

/** True while this server instance is sending source-change digests. */
export const isProvenanceNotifyRunning = (): boolean => notifyRunning;

/**
 * Sends one digest per lead for the oldest unsent events, then marks the
 * events that every lead has heard about and resets their edges to `active`.
 */
export const runSourceChangeNotifications = async ({
  dryRun = false,
  maxEvents = MAX_EVENTS_PER_RUN,
}: NotifyOptions = {}): Promise<NotifyOutcome> => {
  if (notifyRunning && !dryRun) {
    throw new Error("Source-change notifications are already running on this instance.");
  }
  if (!dryRun) notifyRunning = true;
  try {
    return await notify(dryRun, maxEvents);
  } finally {
    if (!dryRun) notifyRunning = false;
  }
};

const notify = async (dryRun: boolean, maxEvents: number): Promise<NotifyOutcome> => {
  const outcome: NotifyOutcome = {
    events: 0,
    digests: 0,
    sent: 0,
    failed: 0,
    unreachable: 0,
    eventsCompleted: 0,
    edgesReset: 0,
  };

  const rows = await SourceChangeEvent.find({ notifiedAt: null })
    .sort({ changedAt: 1 })
    .limit(maxEvents)
    .lean<EventRow[]>();
  outcome.events = rows.length;
  if (rows.length === 0) return outcome;

  const events = rows.map(toDigestEvent);
  const bookIDs = [...new Set(events.flatMap((e) => e.affected.map((b) => b.bookID)))];
  const projectsByBook = await loadProjectsByBook(bookIDs);
  const allDigests = buildLeadDigests(events, projectsByBook);

  const leadIDs = allDigests.map((d) => d.recipient);
  const users = await User.find(
    { uuid: { $in: leadIDs } },
    { _id: 0, uuid: 1, email: 1, firstName: 1 },
  ).lean<UserRow[]>();
  const userByID = new Map(users.map((u) => [u.uuid, u]));
  const reachable = allDigests.filter((d) => userByID.get(d.recipient)?.email);
  outcome.unreachable = allDigests.length - reachable.length;

  // What each lead has already been told, from earlier (partly failed) runs.
  const eventIDs = events.map((e) => e.eventID);
  const already = new Map<string, Set<string>>();
  const logs = await ProvenanceNotificationLog.find(
    {
      eventID: { $in: eventIDs },
      recipient: { $in: reachable.map((d) => d.recipient) },
      ...liveClaimFilter(),
    },
    { _id: 0, eventID: 1, recipient: 1 },
  ).lean<{ eventID: Types.ObjectId; recipient: string }[]>();
  for (const log of logs) {
    const set = already.get(log.recipient) ?? new Set<string>();
    set.add(String(log.eventID));
    already.set(log.recipient, set);
  }

  /** The lead's digest, limited to the given events. */
  const digestFor = (recipient: string, only: Set<string>): LeadDigest | undefined =>
    buildLeadDigests(
      events.filter((e) => only.has(e.eventID)),
      projectsByBook,
    ).find((d) => d.recipient === recipient);

  const pending = reachable
    .map((digest) => {
      const told = already.get(digest.recipient);
      const fresh = digest.eventIDs.filter((id) => !told?.has(id));
      if (fresh.length === 0) return null;
      return fresh.length === digest.eventIDs.length
        ? digest
        : digestFor(digest.recipient, new Set(fresh));
    })
    .filter((d): d is LeadDigest => Boolean(d));
  outcome.digests = pending.length;

  const resolve = await loadPageRefs(pending);
  const prepare = (digest: LeadDigest): PreparedDigest => {
    const user = userByID.get(digest.recipient) as UserRow;
    return {
      recipient: digest.recipient,
      email: user.email as string,
      name: user.firstName ?? "",
      eventIDs: digest.eventIDs,
      sections: describeDigest(digest, resolve),
    };
  };

  if (dryRun) {
    outcome.preview = pending.map(prepare);
    return outcome;
  }

  for (const digest of pending) {
    const projectIDs = digest.sections.map((s) => s.projectID);
    const claimed = await claimEvents(digest.recipient, digest.eventIDs, projectIDs);
    if (claimed.size === 0) continue;
    const toSend =
      claimed.size === digest.eventIDs.length ? digest : digestFor(digest.recipient, claimed);
    if (!toSend) continue;
    const prepared = prepare(toSend);
    const claimFilter = { eventID: { $in: [...claimed] }, recipient: digest.recipient };
    try {
      await mailAPI.sendSourceChangeDigest(prepared.email, prepared.name, prepared.sections);
      await ProvenanceNotificationLog.updateMany(claimFilter, { $set: { sentAt: new Date() } });
      outcome.sent += 1;
    } catch (err) {
      await ProvenanceNotificationLog.deleteMany(claimFilter);
      outcome.failed += 1;
      notifyLog.warn({ err, recipient: digest.recipient }, "Failed to send source-change digest");
    }
  }

  await completeEvents(rows, reachable, outcome);

  notifyLog.info(
    {
      events: outcome.events,
      digests: outcome.digests,
      sent: outcome.sent,
      failed: outcome.failed,
      unreachable: outcome.unreachable,
      eventsCompleted: outcome.eventsCompleted,
      edgesReset: outcome.edgesReset,
    },
    "Source-change notifications finished",
  );
  return outcome;
};

/**
 * Marks events whose every reachable lead has been emailed (or that reach no
 * one), then resets the edges they flagged once no newer unsent event for
 * the same source is waiting.
 */
const completeEvents = async (
  rows: EventRow[],
  reachable: LeadDigest[],
  outcome: NotifyOutcome,
): Promise<void> => {
  const recipientsByEvent = new Map<string, Set<string>>();
  for (const digest of reachable) {
    for (const id of digest.eventIDs) {
      const set = recipientsByEvent.get(id) ?? new Set<string>();
      set.add(digest.recipient);
      recipientsByEvent.set(id, set);
    }
  }

  const sentLogs = await ProvenanceNotificationLog.find(
    { eventID: { $in: rows.map((r) => r._id) }, sentAt: { $ne: null } },
    { _id: 0, eventID: 1, recipient: 1 },
  ).lean<{ eventID: Types.ObjectId; recipient: string }[]>();
  const sentByEvent = new Map<string, Set<string>>();
  for (const log of sentLogs) {
    const set = sentByEvent.get(String(log.eventID)) ?? new Set<string>();
    set.add(log.recipient);
    sentByEvent.set(String(log.eventID), set);
  }

  const done = rows.filter((row) => {
    const id = String(row._id);
    const sent = sentByEvent.get(id);
    return [...(recipientsByEvent.get(id) ?? [])].every((r) => sent?.has(r));
  });
  if (done.length === 0) return;

  const notifiedAt = new Date();
  await SourceChangeEvent.updateMany(
    { _id: { $in: done.map((r) => r._id) } },
    { $set: { notifiedAt } },
  );
  outcome.eventsCompleted = done.length;

  // A deletion's edges are already `broken`; only edits flag edges.
  const latestRev = new Map<string, number | undefined>();
  for (const row of done) {
    if (row.deleted) continue;
    const prev = latestRev.get(row.sourcePage);
    latestRev.set(
      row.sourcePage,
      prev === undefined ? row.toRev : Math.max(prev, row.toRev ?? prev),
    );
  }
  for (const [sourcePage, toRev] of latestRev) {
    // A newer change nobody has been told about yet keeps the flag up.
    const waiting = await SourceChangeEvent.exists({
      sourcePage: { $eq: sourcePage },
      notifiedAt: null,
    });
    if (waiting) continue;
    const res = await PageReuseEdge.updateMany(
      { source: { $eq: sourcePage }, status: "source-changed" },
      { $set: { status: "active", ...(toRev !== undefined ? { seenRevision: toRev } : {}) } },
    );
    outcome.edgesReset += res.modifiedCount;
  }
};
