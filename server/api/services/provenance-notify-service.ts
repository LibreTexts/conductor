import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { childLogger } from "../../logger.js";
import mailAPI from "../mail.js";
import Project from "../../models/project.js";
import User from "../../models/user.js";
import PageNode from "../../models/pagenode.js";
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
 * once every lead it reaches has been emailed or given up on: a failed send
 * frees its claim for the next run, and after {@link MAX_SEND_ATTEMPTS}
 * failures that lead is skipped for that event, so one address that always
 * bounces can't hold up the queue for everyone.
 */

const notifyLog = childLogger("provenance-notify");

/** Oldest unsent events handled per run. */
const MAX_EVENTS_PER_RUN = 1000;
/** Failed sends of one event to one lead before giving up on that pair. */
const MAX_SEND_ATTEMPTS = 3;
/**
 * A claim with no `sentAt` older than this was left by a run that died
 * between claiming and sending; it is released so the email goes out.
 * Far longer than any send takes, so a live run's claim is never stolen.
 */
const STALE_CLAIM_MS = 30 * 60 * 1000;

/**
 * Claims that still count: sent, given up on, or claimed recently by a run
 * that may be sending. A failed send's claim doesn't count; it's retried.
 */
const liveClaimFilter = () => ({
  $or: [
    { sentAt: { $ne: null } },
    { gaveUpAt: { $ne: null } },
    { claimedAt: { $gt: new Date(Date.now() - STALE_CLAIM_MS) }, failedAt: null },
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
  /** (event, lead) pairs given up on after repeated failed sends, this run. */
  gaveUp: number;
  eventsCompleted: number;
  /** Only on a dry run. */
  preview?: PreparedDigest[];
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/** Projects linked to each affected book; every one is emailed (there is no opting out). */
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
      { $or: batch },
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
      excerptOnly: book.excerptOnly ?? false,
    })),
});

/**
 * Claims (event, lead) pairs for this run. Returns the events claimed; a pair
 * another run already holds is left to it. A pair left by a run that died,
 * or whose last send failed, is taken over with its failure count kept.
 */
const claimEvents = async (
  recipient: string,
  eventIDs: string[],
  projectIDs: string[],
): Promise<Set<string>> => {
  if (eventIDs.length === 0) return new Set();
  const claimedAt = new Date();
  const claimToken = randomUUID();
  const ids = eventIDs.map((id) => new Types.ObjectId(id));

  // Take over this lead's free claims: stale, or failed and waiting for a retry.
  await ProvenanceNotificationLog.updateMany(
    {
      eventID: { $in: ids },
      recipient: { $eq: recipient },
      sentAt: null,
      gaveUpAt: null,
      $or: [
        { claimedAt: { $lte: new Date(Date.now() - STALE_CLAIM_MS) } },
        { failedAt: { $ne: null } },
      ],
    },
    { $set: { claimedAt, claimToken, projectIDs, failedAt: null } },
  );
  // Claim the pairs nobody has touched yet.
  const ops = ids.map((eventID) => ({
    updateOne: {
      filter: { eventID, recipient },
      update: {
        $setOnInsert: { eventID, recipient, projectIDs, claimedAt, claimToken, sentAt: null, failures: 0 },
      },
      upsert: true,
    },
  }));
  try {
    await ProvenanceNotificationLog.bulkWrite(ops, { ordered: false });
  } catch (err) {
    // A concurrent run inserted some pairs first (duplicate key); those are its.
    // Any other write error is real.
    const writeErrors = (err as { writeErrors?: { code?: number }[] })?.writeErrors;
    const onlyDuplicates = writeErrors?.length
      ? writeErrors.every((e) => e.code === 11000)
      : (err as { code?: number })?.code === 11000;
    if (!onlyDuplicates) throw err;
  }
  const mine = await ProvenanceNotificationLog.find(
    { eventID: { $in: ids }, recipient: { $eq: recipient }, claimToken: { $eq: claimToken } },
    { _id: 0, eventID: 1 },
  ).lean<{ eventID: Types.ObjectId }[]>();
  return new Set(mine.map((row) => String(row.eventID)));
};

/**
 * Records a failed send for the claimed pairs and frees them for the next
 * run; pairs that have now failed {@link MAX_SEND_ATTEMPTS} times are given
 * up on. Returns how many were given up on.
 */
const recordFailedSend = async (
  claimFilter: { eventID: { $in: string[] }; recipient: string },
): Promise<number> => {
  const failedAt = new Date();
  await ProvenanceNotificationLog.updateMany(claimFilter, {
    $inc: { failures: 1 },
    $set: { failedAt, claimToken: null },
  });
  const res = await ProvenanceNotificationLog.updateMany(
    { ...claimFilter, failures: { $gte: MAX_SEND_ATTEMPTS }, gaveUpAt: null },
    { $set: { gaveUpAt: failedAt } },
  );
  return res.modifiedCount;
};

let notifyRunning = false;

/** True while this server instance is sending source-change digests. */
export const isProvenanceNotifyRunning = (): boolean => notifyRunning;

/**
 * Sends one digest per lead for the oldest unsent events, then marks the
 * events that every lead has heard about.
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
    gaveUp: 0,
    eventsCompleted: 0,
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
      outcome.failed += 1;
      notifyLog.warn({ err, recipient: digest.recipient }, "Failed to send source-change digest");
      const gaveUp = await recordFailedSend(claimFilter);
      if (gaveUp > 0) {
        outcome.gaveUp += gaveUp;
        notifyLog.warn(
          { recipient: digest.recipient, events: gaveUp, attempts: MAX_SEND_ATTEMPTS },
          "Gave up emailing a lead about source changes after repeated failures",
        );
      }
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
      gaveUp: outcome.gaveUp,
      eventsCompleted: outcome.eventsCompleted,
    },
    "Source-change notifications finished",
  );
  return outcome;
};

/**
 * Marks events whose every reachable lead has been emailed or given up on
 * (or that reach no one). The links they flagged stay `source-changed` until each book's
 * project marks the change reviewed.
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
    {
      eventID: { $in: rows.map((r) => r._id) },
      $or: [{ sentAt: { $ne: null } }, { gaveUpAt: { $ne: null } }],
    },
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

  // Links stay `source-changed` after the email: only a lead or liaison
  // marking the change reviewed on Content Sources clears them, per book.
};
