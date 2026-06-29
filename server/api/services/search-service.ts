import { Index, MeiliSearch } from "meilisearch";
import { createHash } from "crypto";
import { debugServer, debugError } from "../../debug";
import Organization from "../../models/organization";
import { FilterInput, FilterValue } from "../../types";

export const INDEXES = ["books", "projects", "supportTickets", "users"] as const;

// Popular-search-terms index. Kept outside INDEXES so its (different) document shape and
// looser typing do not leak into addDocuments/search/getIndexStats, which are tuple-typed.
// This whole subsystem is best-effort: failures here must NEVER affect core search.
export const SEARCH_QUERIES_INDEX = "search-queries";
const SEARCH_QUERIES_PRIMARY_KEY = "id";
const SEARCH_QUERIES_SEARCHABLE = ["query", "normalizedQuery"];
const SEARCH_QUERIES_FILTERABLE = ["scope"];
const SEARCH_QUERIES_SORTABLE = ["count", "lastSeen"];
const SEARCH_QUERIES_FLUSH_MS = Number(process.env.MEILI_SEARCH_QUERY_FLUSH_MS) || 60_000;
const FEATURE_FLAG_TTL_MS = 60_000;

type SearchQueryBufferEntry = {
  query: string;
  normalizedQuery: string;
  scope: string;
  delta: number;
  lastSeen: number;
};
const INDEX_NOT_FOUND_ERROR =
  "Index was not found. Are you using the correct index name?";

export const INDEX_PRIMARY_KEYS: Record<(typeof INDEXES)[number], string> = {
  books: "bookID",
  projects: "projectID",
  supportTickets: "uuid",
  users: "uuid",
};

export const INDEX_FILTERABLE_ATTRIBUTES = {
  books: ["bookID", "library", "license", "author", "course", "courseNormalized", "affiliation", "location", "license", "subject"],
  projects: ["status", "classification", "visibility", "orgID"],
  supportTickets: ["queue_id", "status", "priority", "category", "assignedUUIDs"],
  users: ["uuid", "emailDomain"],
};

export const INDEX_SORTABLE_ATTRIBUTES = {
  books: ["bookID", "library", "author", "course", "courseNormalized", "affiliation", "location"],
  projects: ["status", "classification", "visibility", "orgID"],
  supportTickets: ["status", "category", "timeOpened"],
  users: ["firstName", "lastName"],
};

// Per-index searchable-attribute overrides. Indexes absent from this map use the
// Meilisearch default (all fields searchable). The users index opts in explicitly so a
// query can only ever match a name — never the opaque uuid/centralID or the emailDomain.
export const INDEX_SEARCHABLE_ATTRIBUTES: Partial<Record<(typeof INDEXES)[number], string[]>> = {
  users: ["firstName", "lastName"],
};

export default class SearchService {
  private static instance: SearchService | null = null;
  private static initPromise: Promise<SearchService> | null = null;

  public _client = new MeiliSearch({
    host: process.env.MEILISEARCH_URL || "http://localhost:7700",
    apiKey: process.env.MEILISEARCH_API_KEY || "",
  });
  private indexes = new Map<string, Index>();

  // Popular-search-terms state. All access must be wrapped in try/catch — failure here
  // must never surface to callers.
  private searchQueriesIndex: Index | null = null;
  private searchQueryBuffer = new Map<string, SearchQueryBufferEntry>();
  private searchQueriesFlushTimer: NodeJS.Timeout | null = null;
  private cachedRecordFlag: { value: boolean; expiresAt: number } | null = null;

  private constructor() { }

  /**
   * Returns a cached singleton instance of SearchService.
   * The first call initializes the instance; subsequent calls return the same one.
   * If initialization fails, the next call will retry.
   */
  static async getInstance(): Promise<SearchService> {
    if (this.instance) {
      return this.instance;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = SearchService.create()
      .then((service) => {
        this.instance = service;
        return service;
      })
      .catch((error) => {
        this.initPromise = null; // Allow retry on next call
        throw error;
      });

    return this.initPromise;
  }

  static async create(): Promise<SearchService> {
    const instance = new SearchService();
    await instance.initialize();
    return instance;
  }

  private async initialize() {
    try {
      for (const indexName of INDEXES) {
        const index = await this.ensureIndex(indexName);
        if (index) {
          this.indexes.set(indexName, index);
        }
      }
    } catch (error: any) {
      debugServer(`[SearchService] Error initializing indexes: ${error}`);
      throw error;
    }

    // Popular-search-terms init: best-effort. Must NOT throw, so a missing/broken
    // search-queries index can never block boot or core search.
    try {
      await this.ensureSearchQueriesIndex();
    } catch (error: any) {
      debugError(`[SearchService] search-queries init failed (non-fatal): ${error?.message || error}`);
    }
    try {
      this.startSearchQueriesFlushTimer();
    } catch (error: any) {
      debugError(`[SearchService] could not start search-queries flush timer: ${error?.message || error}`);
    }
  }

  async ensureSearchQueriesIndex(): Promise<void> {
    const indexes = await this._client.getIndexes();
    const found = indexes.results.find((idx) => idx.uid === SEARCH_QUERIES_INDEX);
    let index: Index;
    if (found) {
      index = found;
    } else {
      await this._client.createIndex(SEARCH_QUERIES_INDEX, { primaryKey: SEARCH_QUERIES_PRIMARY_KEY });
      index = this._client.index(SEARCH_QUERIES_INDEX);
    }
    // Apply settings each boot — idempotent.
    await index.updateSearchableAttributes(SEARCH_QUERIES_SEARCHABLE);
    await index.updateFilterableAttributes(SEARCH_QUERIES_FILTERABLE);
    await index.updateSortableAttributes(SEARCH_QUERIES_SORTABLE);
    this.searchQueriesIndex = index;
  }

  private startSearchQueriesFlushTimer() {
    if (this.searchQueriesFlushTimer) return;
    this.searchQueriesFlushTimer = setInterval(() => {
      // Wrap so a rejected promise can't crash the process.
      this.flushSearchQueries().catch((err) => {
        debugError(`[SearchService] flushSearchQueries failed: ${err?.message || err}`);
      });
    }, SEARCH_QUERIES_FLUSH_MS);
    // Don't keep the event loop alive solely for this timer.
    if (typeof this.searchQueriesFlushTimer.unref === "function") {
      this.searchQueriesFlushTimer.unref();
    }
  }

  private normalizeSearchQuery(raw: string): string {
    return raw.toLowerCase().replace(/\s+/g, " ").trim();
  }

  private searchQueryDocId(scope: string, normalizedQuery: string): string {
    return createHash("sha1").update(`${scope}|${normalizedQuery}`).digest("hex");
  }

  private async shouldRecordSearchQueries(): Promise<boolean> {
    const now = Date.now();
    if (this.cachedRecordFlag && this.cachedRecordFlag.expiresAt > now) {
      return this.cachedRecordFlag.value;
    }
    try {
      const org = await Organization.findOne({ orgID: process.env.ORG_ID });
      // @ts-ignore — flag is defined on the Organization model but typing may not surface it here.
      const value = Boolean(org?.FEAT_RecordSearchQueries);
      this.cachedRecordFlag = { value, expiresAt: now + FEATURE_FLAG_TTL_MS };
      return value;
    } catch (err: any) {
      debugError(`[SearchService] feature flag lookup failed: ${err?.message || err}`);
      return false;
    }
  }

  /**
   * Records a single search query into an in-memory buffer. Fire-and-forget; never throws.
   * The buffer is flushed to the search-queries Meilisearch index on an interval.
   */
  async recordSearchQuery(rawQuery: string, scope: string): Promise<void> {
    try {
      if (!rawQuery || typeof rawQuery !== "string" || !scope) return;
      const normalized = this.normalizeSearchQuery(rawQuery);
      if (!normalized) return;
      const key = `${scope}|${normalized}`;
      const now = Date.now();
      const existing = this.searchQueryBuffer.get(key);
      if (existing) {
        existing.delta += 1;
        existing.lastSeen = now;
      } else {
        this.searchQueryBuffer.set(key, {
          query: rawQuery.trim(),
          normalizedQuery: normalized,
          scope,
          delta: 1,
          lastSeen: now,
        });
      }
    } catch (err: any) {
      debugError(`[SearchService] recordSearchQuery swallowed error: ${err?.message || err}`);
    }
  }

  /**
   * Drains the in-memory buffer and upserts counts into the search-queries index.
   * Best-effort: never throws; on failure the buffer is dropped so memory can't grow unbounded.
   */
  async flushSearchQueries(): Promise<void> {
    try {
      if (this.searchQueryBuffer.size === 0) return;
      const index = this.searchQueriesIndex;
      if (!index) {
        // Drop the buffer rather than letting it grow forever if the index never came up.
        this.searchQueryBuffer.clear();
        return;
      }
      const enabled = await this.shouldRecordSearchQueries();
      if (!enabled) {
        this.searchQueryBuffer.clear();
        return;
      }

      // Snapshot and clear so new records can keep accumulating during the flush.
      const buffered = Array.from(this.searchQueryBuffer.values());
      this.searchQueryBuffer.clear();

      // Read-modify-write upsert. NOTE: not atomic across processes — two instances flushing
      // concurrently can lose increments. Acceptable at current scale (this is a nicety, not
      // a billing system). If/when it matters, swap the buffer for Redis INCR or move to
      // Meilisearch Cloud's native analytics.
      const documents: any[] = [];
      for (const entry of buffered) {
        const id = this.searchQueryDocId(entry.scope, entry.normalizedQuery);
        let existingCount = 0;
        try {
          const doc: any = await index.getDocument(id);
          if (doc && typeof doc.count === "number") existingCount = doc.count;
        } catch {
          // 404 / not found — treat as zero. Any other failure is also treated as zero
          // to avoid blocking the whole batch on one bad read.
        }
        documents.push({
          id,
          query: entry.query,
          normalizedQuery: entry.normalizedQuery,
          scope: entry.scope,
          count: existingCount + entry.delta,
          lastSeen: entry.lastSeen,
        });
      }

      if (documents.length > 0) {
        await index.addDocuments(documents, { primaryKey: SEARCH_QUERIES_PRIMARY_KEY });
      }
    } catch (err: any) {
      debugError(`[SearchService] flushSearchQueries swallowed error: ${err?.message || err}`);
    }
  }

  /**
   * Management helper: returns the live search-queries index handle, ensuring it exists.
   * Throws on failure (this is for admin endpoints, not the hot path).
   */
  async getSearchQueriesIndex(): Promise<Index> {
    if (!this.searchQueriesIndex) {
      await this.ensureSearchQueriesIndex();
    }
    if (!this.searchQueriesIndex) {
      throw new Error("search-queries index is not available");
    }
    return this.searchQueriesIndex;
  }

  /**
   * Management helper: wipes all documents from the search-queries index and drops
   * any buffered-but-unflushed entries. The index itself is preserved.
   * Throws on failure so the caller can surface a meaningful error.
   */
  async clearSearchQueries(): Promise<void> {
    this.searchQueryBuffer.clear();
    const index = await this.getSearchQueriesIndex();
    await index.deleteAllDocuments();
  }

  /**
   * Returns popular-query suggestions for typeahead. Best-effort: any failure
   * returns an empty list so the UI degrades to "no suggestions" rather than erroring.
   */
  async getSearchSuggestions(params: {
    scope: string;
    q?: string;
    limit?: number;
  }): Promise<{ query: string; count: number }[]> {
    try {
      const index = this.searchQueriesIndex;
      if (!index) return [];
      const limit = Math.min(Math.max(1, params.limit ?? 10), 25);
      const result: any = await index.search(params.q ?? "", {
        filter: [`scope = "${params.scope.replace(/"/g, '\\"')}"`],
        sort: ["count:desc", "lastSeen:desc"],
        limit,
      });
      const hits: any[] = result?.hits || [];
      return hits.map((h) => ({ query: h.query, count: h.count }));
    } catch (err: any) {
      debugError(`[SearchService] getSearchSuggestions swallowed error: ${err?.message || err}`);
      return [];
    }
  }

  async ensureIndex(indexName: (typeof INDEXES)[number]) {
    try {
      const expectedPrimaryKey = INDEX_PRIMARY_KEYS[indexName];
      const indexes = await this._client.getIndexes();
      const foundIndex = indexes.results.find((idx) => idx.uid === indexName);
      if (foundIndex) {
        // Verify the existing index has the expected primary key. If it doesn't,
        // the index was likely auto-created by an earlier addDocuments call that
        // couldn't infer a primary key — which is the exact failure mode behind
        // index_primary_key_multiple_candidates_found. Try to correct it.
        const currentPrimaryKey = (foundIndex as any).primaryKey;
        if (currentPrimaryKey !== expectedPrimaryKey) {
          debugServer(
            `[SearchService] Index ${indexName} has primaryKey='${currentPrimaryKey ?? "none"}', expected '${expectedPrimaryKey}'. Attempting to correct.`
          );
          try {
            await foundIndex.update({ primaryKey: expectedPrimaryKey });
          } catch (updateErr: any) {
            debugServer(
              `[SearchService] Could not update primaryKey for index ${indexName} (this requires the index to be empty): ${updateErr.message || updateErr}. ` +
              `addDocuments calls will still pass primaryKey='${expectedPrimaryKey}' as a fallback.`
            );
          }
        }

        // Ensure filterable attributes are updated
        const filterAttrs = INDEX_FILTERABLE_ATTRIBUTES[indexName];
        if (filterAttrs) {
          await foundIndex.updateFilterableAttributes(filterAttrs);
        }

        // Ensure sortable attributes are updated
        const sortAttrs = INDEX_SORTABLE_ATTRIBUTES[indexName];
        if (sortAttrs) {
          await foundIndex.updateSortableAttributes(sortAttrs);
        }

        // Ensure searchable attributes are updated (only for indexes that opt out of
        // the all-fields default).
        const searchAttrs = INDEX_SEARCHABLE_ATTRIBUTES[indexName];
        if (searchAttrs) {
          await foundIndex.updateSearchableAttributes(searchAttrs);
        }

        return foundIndex;
      }

      await this._client.createIndex(indexName, { primaryKey: expectedPrimaryKey });
      const index = this._client.index(indexName);
      await index.updateFilterableAttributes(
        INDEX_FILTERABLE_ATTRIBUTES[indexName]
      );
      await index.updateSortableAttributes(
        INDEX_SORTABLE_ATTRIBUTES[indexName]
      );
      const newSearchAttrs = INDEX_SEARCHABLE_ATTRIBUTES[indexName];
      if (newSearchAttrs) {
        await index.updateSearchableAttributes(newSearchAttrs);
      }
      return index;
    } catch (error: any) {
      debugServer(
        `[SearchService] Error ensuring index ${indexName} exists: ${error}`
      );
      throw error;
    }
  }

  async getIndexStats(indexName: (typeof INDEXES)[number]) {
    try {
      const index = this.indexes.get(indexName);
      if (!index) {
        throw new Error(INDEX_NOT_FOUND_ERROR);
      }

      return index.getStats();
    } catch (error: any) {
      debugServer(
        `[SearchService] Error getting stats for index ${indexName}: ${error}`
      );
      throw error;
    }
  }

  async getFilterableAttributes(indexName: (typeof INDEXES)[number]) {
    try {
      const index = this.indexes.get(indexName);
      if (!index) {
        throw new Error(INDEX_NOT_FOUND_ERROR);
      }

      return index.getFilterableAttributes();
    } catch (error: any) {
      debugServer(
        `[SearchService] Error getting filterable attributes for index ${indexName}: ${error}`
      );
      throw error;
    }
  }

  async getSortableAttributes(indexName: (typeof INDEXES)[number]) {
    try {
      const index = this.indexes.get(indexName);
      if (!index) {
        throw new Error(INDEX_NOT_FOUND_ERROR);
      }

      return index.getSortableAttributes();
    } catch (error: any) {
      debugServer(
        `[SearchService] Error getting sortable attributes for index ${indexName}: ${error}`
      );
      throw error;
    }
  }

  async addDocuments(
    indexName: (typeof INDEXES)[number],
    documents: any[],
    { waitForCompletion = false, timeOutMs = 60_000 }: { waitForCompletion?: boolean; timeOutMs?: number } = {}
  ) {
    try {
      const index = this.indexes.get(indexName);
      if (!index) {
        throw new Error(INDEX_NOT_FOUND_ERROR);
      }

      // Always pass the registered primary key explicitly. If the index has no primary key
      // yet (e.g. it was auto-created by a previous addDocuments call without one), this
      // both sets it and avoids Meilisearch's primary-key inference — which fails when
      // multiple fields end in "id" (e.g. uuid + queue_id + userUUID for supportTickets).
      const primaryKey = INDEX_PRIMARY_KEYS[indexName];
      const enqueued = await index.addDocuments(documents, { primaryKey });

      if (!waitForCompletion) return enqueued;

      // POST /indexes/{uid}/documents is asynchronous — the HTTP call only enqueues a task.
      // Document-level validation errors (missing_document_id, invalid_document_id,
      // invalid_document_fields, document_fields_limit_reached, type-inference collisions, etc.)
      // are reported via task status, not the HTTP response. Wait for the task and throw on failure.
      const finished: any = await this._client.tasks.waitForTask(enqueued.taskUid, { timeout: timeOutMs });
      if (finished.status === "failed" || finished.status === "canceled") {
        const err: any = new Error(
          `[Meilisearch] Task ${finished.uid} for index ${indexName} finished with status '${finished.status}': ` +
          `${finished.error?.code ?? "unknown_code"} — ${finished.error?.message ?? "no message"} ` +
          `(type=${finished.error?.type ?? "?"}, link=${finished.error?.link ?? "?"})`
        );
        err.meilisearchError = finished.error;
        err.meilisearchTask = finished;
        throw err;
      }
      return finished;
    } catch (error: any) {
      debugServer(
        `[SearchService] Error adding ${documents.length} documents to index ${indexName}: ${error.message || error}`
      );
      if (error.message && typeof error.message === 'string') {
        debugServer(`[SearchService] Error details: ${error.message}`);
      }
      if (error.code) {
        debugServer(`[SearchService] Error code: ${error.code}`);
      }
      if (error.meilisearchError) {
        debugServer(`[SearchService] Meilisearch task error: ${JSON.stringify(error.meilisearchError)}`);
      }
      throw error;
    }
  }

  async getTask(taskUid: number): Promise<any> {
    try {
      return await this._client.tasks.getTask(taskUid);
    } catch (error: any) {
      debugServer(`[SearchService] Error getting task ${taskUid}: ${error.message || error}`);
      throw error;
    }
  }

  async deleteDocuments(indexName: (typeof INDEXES)[number], ids: string[]) {
    try {
      const index = this.indexes.get(indexName);
      if (!index) {
        throw new Error(INDEX_NOT_FOUND_ERROR);
      }
      return index.deleteDocuments(ids);
    } catch (error: any) {
      debugServer(
        `[SearchService] Error deleting documents from index ${indexName}: ${error}`
      );
      throw error;
    }
  }

  async search(
    indexName: (typeof INDEXES)[number],
    query: string,
    filters?: FilterInput,
    sort?: { field: string; order: "asc" | "desc" }[],
    options = {}
  ) {
    try {
      const index = this.indexes.get(indexName);
      if (!index) {
        throw new Error(INDEX_NOT_FOUND_ERROR);
      }

      const searchOptions: any = { ...options };
      if (filters) {
        searchOptions.filter = this.buildFilterString(filters);
      }
      if (sort) {
        searchOptions.sort = sort.map(({ field, order }) => `${field}:${order}`);
      }

      return index.search(query, searchOptions);
    } catch (error: any) {
      debugServer(
        `[SearchService] Error searching index ${indexName}: ${error}`
      );
      throw error;
    }
  }

  /**
   * Builds a Meilisearch filter string from various input formats.
   * Supports:
   * - Simple object: { field: value } or { field: [val1, val2] }
   * - Operator-based: { field: { $eq: value, $ne: value, $gt: value, $gte: value, $lt: value, $lte: value, $in: [...], $exists: true, $null: true } }
   * - Complex logic: { $and: [...], $or: [...], $not: {...} }
   * - Raw filter strings
   */
  buildFilterString(input: FilterInput): string {
    if (!input) return "";

    // If it's already a string, return it directly
    if (typeof input === "string") {
      return input;
    }

    // If it's an array, treat as implicit AND
    if (Array.isArray(input)) {
      const parts = input.map(item => this.buildFilterString(item)).filter(Boolean);
      return parts.length > 1 ? `(${parts.join(" AND ")})` : parts[0] || "";
    }

    // Handle logical operators
    if ("$and" in input) {
      const parts = input.$and!.map(item => this.buildFilterString(item)).filter(Boolean);
      return parts.length > 1 ? `(${parts.join(" AND ")})` : parts[0] || "";
    }

    if ("$or" in input) {
      const parts = input.$or!.map(item => this.buildFilterString(item)).filter(Boolean);
      return parts.length > 1 ? `(${parts.join(" OR ")})` : parts[0] || "";
    }

    if ("$not" in input) {
      const inner = this.buildFilterString(input.$not!);
      return inner ? `NOT (${inner})` : "";
    }

    // Handle field-based filters
    const filterParts: string[] = [];

    for (const [field, value] of Object.entries(input)) {
      // Skip logical operators already handled
      if (field.startsWith("$")) continue;

      const filterPart = this.buildFieldFilter(field, value);
      if (filterPart) {
        filterParts.push(filterPart);
      }
    }

    return filterParts.length > 1 ? filterParts.join(" AND ") : filterParts[0] || "";
  }

  private buildFieldFilter(field: string, value: FilterValue | FilterInput[] | FilterInput | undefined): string {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return `${field} IS NULL`;
    }

    // Handle nested FilterInput (objects with logical operators like $and, $or, $not)
    if (typeof value === "object" && !Array.isArray(value) && ("$and" in value || "$or" in value || "$not" in value)) {
      // This is a nested filter object, recursively build it
      const nested = this.buildFilterString(value as FilterInput);
      return nested;
    }

    // Handle operator objects
    if (typeof value === "object" && !Array.isArray(value)) {
      const operatorParts: string[] = [];

      for (const [op, opValue] of Object.entries(value)) {
        switch (op) {
          case "$eq":
            operatorParts.push(this.buildComparison(field, "=", opValue));
            break;
          case "$ne":
            operatorParts.push(`NOT ${this.buildComparison(field, "=", opValue)}`);
            break;
          case "$gt":
            operatorParts.push(this.buildComparison(field, ">", opValue));
            break;
          case "$gte":
            operatorParts.push(this.buildComparison(field, ">=", opValue));
            break;
          case "$lt":
            operatorParts.push(this.buildComparison(field, "<", opValue));
            break;
          case "$lte":
            operatorParts.push(this.buildComparison(field, "<=", opValue));
            break;
          case "$in":
            if (Array.isArray(opValue) && opValue.length > 0) {
              const inParts = opValue.map(v => this.buildComparison(field, "=", v));
              operatorParts.push(`(${inParts.join(" OR ")})`);
            }
            break;
          case "$exists":
            operatorParts.push(opValue ? `${field} EXISTS` : `NOT ${field} EXISTS`);
            break;
          case "$null":
            operatorParts.push(opValue ? `${field} IS NULL` : `${field} IS NOT NULL`);
            break;
          case "$empty":
            operatorParts.push(opValue ? `${field} IS EMPTY` : `${field} IS NOT EMPTY`);
            break;
        }
      }

      return operatorParts.length > 1 ? `(${operatorParts.join(" AND ")})` : operatorParts[0] || "";
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) return "";

      // Check if array contains FilterInput objects or primitives
      const firstElement = value[0];
      if (typeof firstElement === "object" && firstElement !== null && !Array.isArray(firstElement)) {
        // Array of FilterInput objects - treat as implicit AND
        const parts = value.map(item => this.buildFilterString(item as FilterInput)).filter(Boolean);
        return parts.length > 1 ? `(${parts.join(" AND ")})` : parts[0] || "";
      }

      // Array of primitives - implicit OR for multiple values of same field
      if (value.length === 1) {
        return this.buildComparison(field, "=", value[0]);
      }
      const orParts = value.map(v => this.buildComparison(field, "=", v));
      return `(${orParts.join(" OR ")})`;
    }

    // Handle simple value (implicit equality)
    return this.buildComparison(field, "=", value);
  }

  private buildComparison(field: string, operator: string, value: any): string {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return `${field} IS NULL`;
    }

    // Handle boolean
    if (typeof value === "boolean") {
      return `${field} ${operator} ${value}`;
    }

    // Handle number
    if (typeof value === "number") {
      return `${field} ${operator} ${value}`;
    }

    // Handle string (needs quotes and escaping)
    return `${field} ${operator} "${this.escapeFilterValue(String(value))}"`;
  }

  private escapeFilterValue(value: string): string {
    // Escape double quotes and backslashes
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
}
