import { Index, MeiliSearch } from "meilisearch";
import { debugServer } from "../../debug";

export const INDEXES = ["books", "projects"] as const;
const INDEX_NOT_FOUND_ERROR =
  "Index was not found. Are you using the correct index name?";

export const INDEX_FILTERABLE_ATTRIBUTES = {
  books: ["bookID", "library", "license", "author", "course", "affiliation"],
};

export default class SearchService {
  private client = new MeiliSearch({
    host: process.env.MEILISEARCH_URL || "http://localhost:7700",
    apiKey: process.env.MEILISEARCH_API_KEY || "",
  });
  private indexes = new Map<string, Index>();

  private constructor() {}

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
      const indexes = await this.client.getIndexes();
      const foundIndex = indexes.results.find((idx) => idx.uid === indexName);
      if (foundIndex) {
        return foundIndex;
      }

      if (indexName === "books") {
        await this.client.createIndex(indexName, { primaryKey: "bookID" });
        const index = this.client.index(indexName);
        await index.updateFilterableAttributes(
          INDEX_FILTERABLE_ATTRIBUTES.books
        );
        return index;
      }
      if (indexName === "projects") {
        await this.client.createIndex(indexName, { primaryKey: "projectID" });
        const index = this.client.index(indexName);
        return index;
      }
    } catch (error: any) {
      debugServer(
        `[SearchService] Error ensuring index ${indexName} exists: ${error}`
      );
      throw error;
    }
  }

  async addDocuments(indexName: (typeof INDEXES)[number], documents: any[]) {
    try {
      const index = this.indexes.get(indexName);
      if (!index) {
        throw new Error(INDEX_NOT_FOUND_ERROR);
      }

      return index.addDocuments(documents);
    } catch (error: any) {
      debugServer(
        `[SearchService] Error adding documents to index ${indexName}: ${error}`
      );
      throw error;
    }
  }

  async search(
    indexName: (typeof INDEXES)[number],
    query: string,
    options = {}
  ) {
    try {
      const index = this.indexes.get(indexName);
      if (!index) {
        throw new Error(INDEX_NOT_FOUND_ERROR);
      }
      return index.search(query, options);
    } catch (error: any) {
      debugServer(
        `[SearchService] Error searching index ${indexName}: ${error}`
      );
      throw error;
    }
  }

  buildFilterString(fieldMap: Record<string, string[]>): string {
    const filterParts: string[] = [];
    for (const [field, values] of Object.entries(fieldMap)) {
      if (values.length === 1) {
        filterParts.push(`${field} = "${this.escapeFilterValue(values[0])}"`);
      } else if (values.length > 1) {
        const orParts = values.map((value) => `${field} = "${this.escapeFilterValue(value)}"`);
        filterParts.push(`(${orParts.join(" OR ")})`);
      }
    }
    return filterParts.join(" AND ");
  }

  private escapeFilterValue(value: string): string {
    // Escape double quotes and backslashes
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
}
