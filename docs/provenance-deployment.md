# Page provenance: deployment runbook

What to set up when deploying the page provenance work (`feat/pages-graphification`):
scheduled jobs, environment settings, database changes and migrations, plus a safe rollout order.

Provenance tracks where every library page's content comes from (original, transcluded, forked or copied, including chains A → B → C). It emails project leads when a page their book reuses changes, and backs the project **Content Sources** page and the Control Panel **Content Reuse** tool.

Two rules hold throughout:

- **Nothing is written to the libraries.** Provenance only reads from CXone/MindTouch and stores everything in Conductor's own MongoDB collections.
- **Nothing runs until it's scheduled.** The automation routes are inert until an external scheduler calls them, so deploying the code alone changes nothing for users except the two new pages.

---

## 1. Database

### Migrations

**A first deployment needs no data migration.** All provenance data lives in new collections that start empty and are filled by the scanner. Upgrading a deployment that already has summaries needs one backfill (below).

| Migration | Status | Notes |
|---|---|---|
| Seed reuse links from past Remixer history (`ProjectRemixerJob` / saved Remixer states) | Planned, not written yet | Optional. Without it, older remixed books are still found by the scanner: transclusions from their markup, and forks only as Phase 4 fingerprinting lands. |
| `server/migrations/BackfillBookReuseAttention.ts` | Upgrade only | Fills `unscannedSources` and `attention` on summaries written before those fields existed. A first deployment doesn't need it. See *Upgrading an existing deployment: library counts on summaries* below. |

### New collections

These are created automatically on first write, with their indexes built by Mongoose at server startup (`autoIndex` is on by default and isn't disabled in this codebase):

| Collection | What it holds | Size | Expiry |
|---|---|---|---|
| `pagenodes` | One document per library page | Largest (one per page, ~200 B each) | none |
| `pagereuseedges` | One document per direct reuse link | Moderate | none |
| `bookreusesummaries` | One rollup per book | Small | none |
| `provenancescanstates` | Per-library scan progress and lease | Tiny | none |
| `sourcechangeevents` | Changes to reused pages | Small | 90 days |
| `provenancenotificationlogs` | Claims that stop duplicate emails | Small | 90 days |

If `autoIndex` is ever turned off for production, run `syncIndexes()` once for the six models above (`server/models/{pagenode,pagereuseedge,bookreusesummary,provenancescanstate,sourcechangeevent,provenancenotificationlog}.ts`).

### Change to an existing collection

- `projects` is unchanged. Source-change emails can't be turned off, so there's no per-project setting.

---

## 2. Environment

No new required variables. These already exist and must be set as they are today:

- `LIBRE_API_KEY`: the bearer token the schedulers send.
- The AWS/SSM library credentials, used read-only for every library call.
- `MAILGUN_*`.

**Mail:** real email goes out only when `NODE_ENV=production`; otherwise `mail.js` just logs it.

Optional tuning, all with safe defaults:

| Variable | Default | Effect |
|---|---|---|
| `PROVENANCE_SCAN_INTERVAL_MS` | `250` | Gap between requests to one library (throttle). Raise it if a library's API is under strain. |
| `PROVENANCE_RESCAN_AFTER_MS` | `604800000` (7 days) | How long a library that finished a full walk waits before it's walked again. A safety net: the changes job catches edits in between. |
| `PROVENANCE_SOURCE_CHECK_INTERVAL_MS` | `86400000` (24 h) | How often each reused page's revision is re-read directly. A safety net behind the change feed. |
| `PROVENANCE_EVENTS_MAX_PAGES` | `25` | Change-feed pages (200 events each) the changes job reads per library per run before calling it a gap. |
| `PROVENANCE_EXCLUDED_LIBRARIES` | `dev` | Comma-separated libraries the backfill never walks. Their pages that books elsewhere reuse are still tracked; `?book=` scans of their books still run. Set it to empty to exclude none. |

---

## 3. Scheduled jobs

Add these wherever `PUT /api/v1/alerts/processdaily` is already scheduled (cron or EventBridge). All three take the existing key, run on **one** server instance, and answer `202` immediately while the work continues in the background.

| Job | Route | Schedule | What it does |
|---|---|---|---|
| **Scan** | `PUT /api/v1/provenance/automation/scan` | Every **15–60 min** | Continues the library backfill where it stopped, and runs the daily safety-net check of reused pages. Each call works for up to `?minutes=` (default 10, max 55); pick a schedule interval longer than that budget. |
| **Changes** | `PUT /api/v1/provenance/automation/changes` | **Once to a few times a day**, before notify | Reads each library's change feed from where the last run stopped, applies it, and re-reads the books it showed changes in. See *Change feed* below. |
| **Notify** | `PUT /api/v1/provenance/automation/notify` | **Daily**, after the changes job | Sends each project lead one email covering the changes since the last run. |

```bash
# Scan: one 10-minute slice across all synced libraries
curl -X PUT -H "Authorization: Bearer $LIBRE_API_KEY" \
  "https://<conductor-host>/api/v1/provenance/automation/scan?minutes=10"

# Notify: daily lead emails
curl -X PUT -H "Authorization: Bearer $LIBRE_API_KEY" \
  "https://<conductor-host>/api/v1/provenance/automation/notify"
```

**Which libraries are scanned:** every library with `hidden: false` and `syncSupported: true`, except those in `PROVENANCE_EXCLUDED_LIBRARIES` (default `dev`). The **dev library is not backfilled in production**: only its pages that books elsewhere reuse are tracked, and the source check reads just those pages.

Useful query options:

- **Scan:**
  - `?library=chem,bio` limits a run to those libraries.
  - `?book=chem-12345` scans specific books, which also works for libraries that aren't sync-enabled.
  - `?force=true` re-reads every page, even unchanged ones. Use it once after a change to how pages are classified.
- **Notify:** `?dryRun=true` returns the emails it would send, and sends and changes nothing.

Running a job twice is harmless:

- **Scan:** each library has a lease, so two runs can't scan the same library at once.
- **Notify:** a lead is never emailed twice about the same change, even if two instances run it, and a failed send is retried on the next run.

---

### Change feed
Each library has a change feed: `GET https://{lib}.libretexts.org/@api/deki/events/page-hierarchy/home`, newest first, read with Conductor's server token. **Only the changes job reads it**; nothing on the library side calls Conductor, and no webhooks are needed.

```bash
# Changes: read every library's feed from its last position (10-minute budget)
curl -X PUT -H "Authorization: Bearer $LIBRE_API_KEY"   "https://<conductor-host>/api/v1/provenance/automation/changes?minutes=10"

# See what it would do, without writing anything or moving the cursors
curl -X PUT -H "Authorization: Bearer $LIBRE_API_KEY"   "https://<conductor-host>/api/v1/provenance/automation/changes?library=chem&dryRun=true"
```

**Libraries covered:** every synced library, plus every library holding a page that books elsewhere reuse. That includes dev, whose own books still aren't backfilled.

**What the job does with the events, per library:**
- **A reused page outside any scanned book was edited:** records the change for its readers' leads.
- **A page was deleted:** marks it deleted. Live reuse of it shows "Source deleted", and its readers' leads are told.
- **A page was moved or renamed:** updates its path and title.
- **A page in a scanned book was edited, created, restored or moved:** queues the book, and the job re-reads it. A re-read only fetches pages whose revision moved. Forks made in place, new or removed reuse, and new pages show up within hours instead of a week.

**Cursors and gaps:**
- **Per-library cursor:** each library keeps its own (`eventsCursor` in `provenancescanstates`). A run reads only what happened since, and a library the time budget didn't reach is first in line next run. Content Reuse → *By library* shows each feed's last read, and how many books are waiting to be re-read.
- **First run:** the first run on a library only records where the feed is now. History is the backfill's job.
- **Gap:** if a library had more than `PROVENANCE_EVENTS_MAX_PAGES` × 200 events since its last read, the job applies the newest and records a **gap**, shown as a warning badge on Content Reuse. It also makes that library's reused pages due for the direct check, and its next scan does a full re-walk, so nothing is lost for good. Schedule the job more often if gaps keep appearing. The badge clears on the next read without a gap.
- **Failed read:** if a feed page or a grouped event's detail can't be read before the job reaches the cursor, nothing is applied and the cursor stays. The library shows `failed` in the job's result and a `Change feed read incomplete` warning in the logs, and the next run reads the same span again. A library that fails run after run needs a look; nothing else catches up for it until its 24-hour source check.
- **Off-host detail links:** a grouped event whose detail link isn't on `https://{lib}.libretexts.org` is never followed (the request would carry the library's token). Only its headline event is applied, and the job logs a warning.

## 4. Rollout order

1. **Deploy.** Nothing runs yet. The Content Sources page says "This book hasn't been scanned yet" until the scanner reaches a book.
2. **Scan one book or library by hand**, for example `…/scan?book=<lib>-<coverID>` or `…/scan?library=<small library>&minutes=10`.
   - **Check:** the book's project → Co-Authoring Tools → **Content Sources** shows page types and sources.
   - **Check:** Control Panel → **Content Reuse** shows the library's totals and scan status.
3. **Schedule the scan job.** The first full backfill takes many runs (it's time-sliced and resumes each time). A book the time budget cuts off part way is picked up again by the next run rather than skipped; its pages already read are unchanged then, so finishing it is quick. Watch progress in Content Reuse → *By library*.
4. **Dry-run notifications:** call `…/notify?dryRun=true` and check the returned emails look right.
5. **Schedule the notify job last.** Only now do leads start getting emails. Every project linked to a scanned book gets them; they can't be turned off.

**What leads see after a change:** emails only tell leads about a change; they don't clear it. A reusing page stays marked "Source changed", and the change stays in **Recent source changes**, until a lead or liaison marks it reviewed on that book's Content Sources page. Each book is reviewed separately. Deletions stay "Source deleted" until the reuse is fixed.

**Remixer:** a Remixer job records what its imported pages reuse in one batch after the job ends, in the background, whether it succeeded or failed partway. It doesn't slow the import. If the server restarts before the batch finishes, the next scan of that library finds the same links.

---

### Upgrading an existing deployment: copied excerpts
Pages are now also checked for blocks copied from other pages: `lt-{library}-{pageID}` classes in the raw content, recorded as "Copied excerpt" links. The page's own class never counts.

Pages scanned before this change were classified without excerpts, and an unchanged page isn't re-read. So, once after deploying, re-read every page with a forced pass per library:
```bash
curl -X PUT -H "Authorization: Bearer $LIBRE_API_KEY"   "https://<conductor-host>/api/v1/provenance/automation/scan?library=<lib>&force=true&minutes=30"
```
Repeat until Content Reuse shows that library as complete again. A first deployment needs nothing extra.

Also in this change:
- **Deleting a source no longer marks copies broken.** Forks, full copies and excerpts keep their content, so only transclusions and embedded sections become "Source deleted". Leads are still told about the deletion.
- **The Restacker's remixing percentage is always measured.** It's the share of text blocks carrying another page's `lt-` class. A page's own class counts as its own content, and only a whole-page transclusion stub is 100%.

### Upgrading an existing deployment: library counts on summaries
Each book's summary now also keeps its reuse from not-yet-scanned libraries (`unscannedSources`) and its pages needing attention (`attention`: source changed, broken). The library map and the book connection graph read these from the summaries instead of grouping every page-level reuse link on each request, which would slow down and could hit MongoDB's 100 MB `$group` limit as the scan covers more books.

Summaries written before this change don't have the fields: until a book is next scanned, the map shows no reuse from unscanned libraries and no attention ring for it. Backfill once after deploying:
```bash
# from server/, with MONGOOSEURI set; uncomment the runner at the bottom of the file first
npx tsx migrations/BackfillBookReuseAttention.ts
```
It recomputes both fields from the links, 8 books at a time, and is safe to re-run (about 3.5 s per 100 books on dev). Afterwards the fields stay current on their own: every summary rebuild writes them, a source change, a broken source and a lead's review refresh them on the books they touch, and a deleted page rebuilds its own book's summary.

## 5. Monitoring

- **Logs** (Pino, queryable by `component`):
  - `provenance-scan`: per-run summary (pages scanned and skipped, links added and removed, errors), plus "Transclusion became a fork".
  - `page-provenance`: "Reused page changed" / "Reused page deleted".
  - `provenance-notify`: "Source-change notifications finished" (emails sent, failed, unreachable, given up). A failed email is retried on the next run. Only the mail provider rejecting a lead's address (a 4xx response) counts against that lead, and only in a run where some other email went through, which proves the mail settings work; after 3 such rejections for the same change the lead is skipped for it ("Gave up emailing a lead about source changes after repeated failures"), so one bad address can't hold up everyone else's emails. A run where every email is rejected counts nothing ("Every source-change email this run was rejected…"), since a bad sender setting looks the same. Provider and configuration problems (5xx, network errors, timeouts, rate limits, bad or expired `MAILGUN_API_KEY`: 401/403, unknown `MAILGUN_DOMAIN`: 404) never count against anyone; after 3 in a row the run stops ("Source-change emails keep failing on the mail provider's side; stopping this run", `providerDown: true`) and everything is retried on the next run. A run that stops this way every day means the mail settings need fixing.
  - `content-sources`: lead actions such as "Source change marked reviewed".
- **Progress:** Control Panel → Content Reuse shows each library's scan status, last run and broken reuse links.
- **Library map:** Control Panel → Content Reuse → *Open the library map* (`/controlpanel/content-reuse/map`) draws every Commons book and every reuse link. It's served by `GET /api/v1/provenance/map` (superadmin and support only), built from the summaries, links, scan state and linked projects, and cached in memory for 10 minutes (`?fresh=true` rebuilds it). The scan and changes jobs rebuild that cache when they finish, so staff rarely wait for a build; the cache is per server instance, so with several instances only the one that ran the job is warmed. Log: `provenance-insights` "Library map rebuilt" (books, links, ms). The browser lays the map out once per data version and keeps that layout in local storage, so a repeat visit shows it at once. It needs no schedule or variable of its own; it fills in as the scan covers more books.

---

## 6. Rollback

- **Stop provenance:** remove the two schedules. Nothing else runs.
- **Code rollback:** reverting the code leaves the new collections in place but unused; they're safe to drop.
- **No cleanup in the libraries**, since provenance never writes to them.

---

## 7. Not part of this deployment

- **CXone webhooks** for faster change detection were investigated and deferred. The feature is off on our sites, and NICE Support has to enable it for each site. Until then the scan job's source check covers changes.
- **Fork fingerprinting** across libraries (Phase 4): only the "transclusion forked in place" case is handled today.
