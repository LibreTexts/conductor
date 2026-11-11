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
**No data migration is required.** All provenance data lives in new collections that start empty and are filled by the scanner.

| Migration | Status | Notes |
|---|---|---|
| Seed reuse links from past Remixer history (`ProjectRemixerJob` / saved Remixer states) | Planned, not written yet | Optional. Without it, older remixed books are still found by the scanner: transclusions from their markup, and forks only as Phase 4 fingerprinting lands. |

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
- **`projects`** gains one optional field, `notifySourceChanges`. Unset means emails are on, and only `false` opts a project out. No backfill and no new index.

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
| `PROVENANCE_RESCAN_AFTER_MS` | `86400000` (24 h) | How long a library that finished a full scan waits before it's scanned again. |
| `PROVENANCE_SOURCE_CHECK_INTERVAL_MS` | `3600000` (1 h) | How often each reused page's revision is re-checked for changes. |

---

## 3. Scheduled jobs

Add these wherever `PUT /api/v1/alerts/processdaily` is already scheduled (cron or EventBridge). Both take the existing key, run on **one** server instance, and answer `202` immediately while the work continues in the background.

| Job | Route | Schedule | What it does |
|---|---|---|---|
| **Scan** | `PUT /api/v1/provenance/automation/scan` | Every **15–60 min** | Checks reused pages for changes first, then continues the library backfill where it stopped. Each call works for up to `?minutes=` (default 10, max 55); pick a schedule interval longer than that budget. |
| **Notify** | `PUT /api/v1/provenance/automation/notify` | **Daily**, some time after a scan | Sends each project lead one email covering the changes since the last run. |

```bash
# Scan: one 10-minute slice across all synced libraries
curl -X PUT -H "Authorization: Bearer $LIBRE_API_KEY" \
  "https://<conductor-host>/api/v1/provenance/automation/scan?minutes=10"

# Notify: daily lead emails
curl -X PUT -H "Authorization: Bearer $LIBRE_API_KEY" \
  "https://<conductor-host>/api/v1/provenance/automation/notify"
```

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

## 4. Rollout order

1. **Deploy.** Nothing runs yet. The Content Sources page says "This book hasn't been scanned yet" until the scanner reaches a book.
2. **Scan one book or library by hand**, for example `…/scan?book=<lib>-<coverID>` or `…/scan?library=<small library>&minutes=10`.
   - **Check:** the book's project → Co-Authoring Tools → **Content Sources** shows page types and sources.
   - **Check:** Control Panel → **Content Reuse** shows the library's totals and scan status.
3. **Schedule the scan job.** The first full backfill takes many runs (it's time-sliced and resumes each time). Watch progress in Content Reuse → *By library*.
4. **Dry-run notifications:** call `…/notify?dryRun=true` and check the returned emails look right.
5. **Schedule the notify job last.** Only now do leads start getting emails. Projects can opt out on their Content Sources page ("Email notifications"), and only leads and liaisons can change that setting.

**What leads see after a change:** emails only tell leads about a change; they don't clear it. A reusing page stays marked "Source changed", and the change stays in **Recent source changes**, until a lead or liaison marks it reviewed on that book's Content Sources page. Each book is reviewed separately. Deletions stay "Source deleted" until the reuse is fixed.

**Remixer:** a Remixer job records what its imported pages reuse in one batch after the job ends, in the background, whether it succeeded or failed partway. It doesn't slow the import. If the server restarts before the batch finishes, the next scan of that library finds the same links.

---

## 5. Monitoring

- **Logs** (Pino, queryable by `component`):
  - `provenance-scan`: per-run summary (pages scanned and skipped, links added and removed, errors), plus "Transclusion became a fork".
  - `page-provenance`: "Reused page changed" / "Reused page deleted".
  - `provenance-notify`: "Source-change notifications finished" (emails sent, failed, unreachable).
  - `content-sources`: lead actions such as "Source change marked reviewed".
- **Progress:** Control Panel → Content Reuse shows each library's scan status, last run and broken reuse links.

---

## 6. Rollback

- **Stop provenance:** remove the two schedules. Nothing else runs.
- **Code rollback:** reverting the code leaves the new collections in place but unused; they're safe to drop. The `projects.notifySourceChanges` field is harmless if left behind.
- **No cleanup in the libraries**, since provenance never writes to them.

---

## 7. Not part of this deployment

- **CXone webhooks** for faster change detection were investigated and deferred. The feature is off on our sites, and NICE Support has to enable it for each site. Until then the scan job's source check covers changes.
- **Fork fingerprinting** across libraries (Phase 4): only the "transclusion forked in place" case is handled today.
