import { Index, MeiliSearch } from "meilisearch";
import { debugServer } from "../../debug";
import { FilterInput, FilterValue } from "../../types";

export const INDEXES = ["books", "projects", "supportTickets"] as const;
const INDEX_NOT_FOUND_ERROR =
  "Index was not found. Are you using the correct index name?";

export const INDEX_PRIMARY_KEYS: Record<(typeof INDEXES)[number], string> = {
  books: "bookID",
  projects: "projectID",
  supportTickets: "uuid",
};

export const INDEX_FILTERABLE_ATTRIBUTES = {
  books: ["bookID", "library", "license", "author", "course", "affiliation", "location", "license", "subject"],
  projects: ["status", "classification", "visibility", "orgID"],
  supportTickets: ["queue_id", "status", "priority", "category", "assignedUUIDs"],
};

export const INDEX_SORTABLE_ATTRIBUTES = {
  books: ["bookID", "library", "author", "course", "affiliation", "location"],
  projects: ["status", "classification", "visibility", "orgID"],
  supportTickets: ["status", "category", "timeOpened"],
};

export default class SearchService {
  private static instance: SearchService | null = null;
  private static initPromise: Promise<SearchService> | null = null;

  public _client = new MeiliSearch({
    host: process.env.MEILISEARCH_URL || "http://localhost:7700",
    apiKey: process.env.MEILISEARCH_API_KEY || "",
  });
  private indexes = new Map<string, Index>();

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
