// server/services/qdrant.ts
import { QdrantClient } from "@qdrant/js-client-rest";
import OpenAI from "openai";

export type VectorSearchSource = "knowledge_base" | "closed_support_ticket";

export interface VectorSearchResult {
  id: string;
  title: string;
  content: string;
  score: number;
  source: VectorSearchSource;
  url?: string;
}

export interface ClosedSupportTicketVector {
  uuid: string;
  title: string;
  description?: string;
  category?: string;
  queueId: string;
  timeOpened: string;
  timeClosed?: string;
  messages: Array<{
    message: string;
    senderIsStaff: boolean;
    timeSent: string;
  }>;
}

const qdrantUrl =
  process.env.QDRANT_URL || process.env.QDRANT_HOST || "http://localhost:6333";

const qdrantClient = new QdrantClient({
  url: qdrantUrl,
  apiKey: process.env.QDRANT_API_KEY,
  port: Number(process.env.QDRANT_PORT) || 443,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

async function testQdrantConnection() {
  try {
    console.log("Testing Qdrant connection Again...");
    // Test connection by listing collections
    const collections = await qdrantClient.getCollections();
    console.log("✅ Qdrant connection OK");
  } catch (error: any) {
    console.error("❌ Failed to connect to Qdrant");
    console.error("Error message:", error.message);
    if (error.cause) console.error("Cause:", error.cause);
  }
}

export class QdrantService {
  private collectionName = "kb_pages";
  private closedSupportTicketsCollection = "closed_support_tickets";
  private vectorSize = 1536; // OpenAI text-embedding-3-small dimension

  /** Full public Insight URL, e.g. https://commons.libretexts.org/insight/sd */
  getInsightPageUrl(slug?: string | null): string | undefined {
    if (!slug) return undefined;
    const domain = (
      process.env.CONDUCTOR_DOMAIN || "commons.libretexts.org"
    )
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "");
    return `https://${domain}/insight/${String(slug).replace(/^\/+/, "")}`;
  }

  private cleanHtml(text: string): string {
    return text
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** One embedding input per page: title + description + body for better retrieval. */
  private formatKBPageEmbeddingText(kbPage: {
    title?: string;
    description?: string;
    body?: string;
  }): string {
    return [
      kbPage.title ? `Title: ${kbPage.title}` : "",
      kbPage.description ? `Description: ${kbPage.description}` : "",
      kbPage.body ? this.cleanHtml(kbPage.body) : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  private async ensureCollection(collectionName: string) {
    const collections = await qdrantClient.getCollections();
    const collectionExists = collections.collections.some(
      (collection) => collection.name === collectionName,
    );

    if (!collectionExists) {
      await qdrantClient.createCollection(collectionName, {
        vectors: { size: this.vectorSize, distance: "Cosine" },
        optimizers_config: { default_segment_number: 2 },
        replication_factor: 1,
      });
    }
  }

  // Initialize Qdrant collection
  async initializeCollection() {
    try {
      await this.ensureCollection(this.collectionName);
      return true;
    } catch (error) {
      console.error("Error initializing Qdrant collection:", error);
      throw error;
    }
  }

  async initializeClosedSupportTicketsCollection() {
    await this.ensureCollection(this.closedSupportTicketsCollection);
  }

  // Generate embeddings from text
  async generateEmbeddings(text: string): Promise<number[]> {
    try {
      const cleanText = this.cleanHtml(text);

      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: cleanText,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embeddings:", error);
      throw error;
    }
  }

  // Upsert a single KB page to Qdrant (one vector point per page)
  async upsertKBPage(kbPage: any) {
    try {
      const cleanText = this.formatKBPageEmbeddingText(kbPage);
      const embeddings = await this.generateEmbeddings(cleanText);
      const url = this.getInsightPageUrl(kbPage.slug);

      const point = {
        id: kbPage.uuid, // Use UUID as point ID
        vector: embeddings,
        payload: {
          uuid: kbPage.uuid,
          title: kbPage.title,
          description: kbPage.description,
          body: kbPage.body,
          slug: kbPage.slug,
          url,
          status: kbPage.status,
          internalOnly: Boolean(kbPage.internalOnly),
          parent: kbPage.parent,
          lastEditedByUUID: kbPage.lastEditedByUUID,
          createdAt: kbPage.createdAt,
          updatedAt: kbPage.updatedAt,
          cleanText,
        },
      };

      await qdrantClient.upsert(this.collectionName, {
        wait: true,
        points: [point],
      });

      return { success: true, uuid: kbPage.uuid, title: kbPage.title, url };
    } catch (error) {
      console.error(`Error upserting KB page ${kbPage.uuid}:`, error);
      return {
        success: false,
        uuid: kbPage.uuid,
        title: kbPage.title,
        error: (error as Error).message,
      };
    }
  }

  // Batch upsert multiple KB pages
  async batchUpsertKBPages(kbPages: any[], batchSize: number = 10) {
    const results: any[] = [];

    for (let i = 0; i < kbPages.length; i += batchSize) {
      const batch = kbPages.slice(i, i + batchSize);
      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(kbPages.length / batchSize)}`,
      );

      const batchPromises = batch.map((page) => this.upsertKBPage(page));
      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            uuid: batch[index].uuid,
            error: result.reason?.message || "Unknown error",
          });
        }
      });

      // Add delay to avoid rate limiting
      if (i + batchSize < kbPages.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  // Search similar pages (public Insight agent: published + not internal-only)
  async searchSimilar(query: string, limit: number = 5, filter?: any) {
    try {
      const queryEmbedding = await this.generateEmbeddings(query);

      const searchResult = await qdrantClient.search(this.collectionName, {
        vector: queryEmbedding,
        limit,
        with_payload: true,
        filter: filter || {
          must: [
            { key: "status", match: { value: "published" } },
            { key: "internalOnly", match: { value: false } },
          ],
        },
      });

      return searchResult.map((point) => ({
        uuid: point.payload?.uuid,
        title: point.payload?.title,
        description: point.payload?.description,
        body: point.payload?.body,
        slug: point.payload?.slug,
        url:
          (point.payload?.url as string | undefined) ||
          this.getInsightPageUrl(
            point.payload?.slug ? String(point.payload.slug) : undefined,
          ),
        score: point.score,
        cleanText: point.payload?.cleanText,
      }));
    } catch (error) {
      console.error("Error searching Qdrant:", error);
      throw error;
    }
  }

  private formatClosedTicketContent(ticket: ClosedSupportTicketVector) {
    const conversation = ticket.messages
      .map(
        (message) =>
          `${message.senderIsStaff ? "Support" : "Requester"}: ${message.message}`,
      )
      .join("\n");

    const content = [
      `Title: ${ticket.title}`,
      ticket.category ? `Category: ${ticket.category}` : "",
      `Request: ${ticket.description || "No description provided."}`,
      conversation ? `Conversation:\n${conversation}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    // Preserve both the original request and the eventual resolution for long threads.
    return content.length <= 24_000
      ? content
      : `${content.slice(0, 8_000)}\n\n[earlier conversation truncated]\n\n${content.slice(-16_000)}`;
  }

  async upsertClosedSupportTicket(ticket: ClosedSupportTicketVector) {
    await this.initializeClosedSupportTicketsCollection();
    const content = this.formatClosedTicketContent(ticket);
    const vector = await this.generateEmbeddings(content);

    await qdrantClient.upsert(this.closedSupportTicketsCollection, {
      wait: true,
      points: [
        {
          id: ticket.uuid,
          vector,
          payload: {
            uuid: ticket.uuid,
            title: ticket.title,
            content,
            category: ticket.category,
            queueId: ticket.queueId,
            status: "closed",
            timeOpened: ticket.timeOpened,
            timeClosed: ticket.timeClosed,
          },
        },
      ],
    });
  }

  async deleteClosedSupportTicket(uuid: string) {
    await this.initializeClosedSupportTicketsCollection();
    await qdrantClient.delete(this.closedSupportTicketsCollection, {
      wait: true,
      points: [uuid],
    });
  }

  async searchSupportKnowledge(
    query: string,
    limitPerCollection: number = 3,
    queueId?: string,
  ): Promise<VectorSearchResult[]> {
    const vector = await this.generateEmbeddings(query);
    await Promise.all([
      this.initializeCollection(),
      this.initializeClosedSupportTicketsCollection(),
    ]);

    // Staff Answer-with-AI: all published Insight pages (including internal-only).
    const [knowledgeBaseResults, closedTicketResults] = await Promise.all([
      qdrantClient.search(this.collectionName, {
        vector,
        limit: limitPerCollection,
        with_payload: true,
        filter: {
          must: [{ key: "status", match: { value: "published" } }],
        },
      }),
      qdrantClient.search(this.closedSupportTicketsCollection, {
        vector,
        limit: limitPerCollection,
        with_payload: true,
        filter: {
          must: [
            { key: "status", match: { value: "closed" } },
            ...(queueId
              ? [{ key: "queueId", match: { value: queueId } }]
              : []),
          ],
        },
      }),
    ]);

    const kb: VectorSearchResult[] = knowledgeBaseResults.map((point) => ({
      id: String(point.payload?.uuid || point.id),
      title: String(point.payload?.title || "Knowledge base article"),
      content: String(point.payload?.cleanText || point.payload?.body || ""),
      score: point.score,
      source: "knowledge_base",
      url:
        (point.payload?.url as string | undefined) ||
        this.getInsightPageUrl(
          point.payload?.slug ? String(point.payload.slug) : undefined,
        ),
    }));
    const tickets: VectorSearchResult[] = closedTicketResults.map((point) => ({
      id: String(point.payload?.uuid || point.id),
      title: String(point.payload?.title || "Resolved support ticket"),
      content: String(point.payload?.content || ""),
      score: point.score,
      source: "closed_support_ticket",
    }));

    return [...kb, ...tickets].sort((a, b) => b.score - a.score);
  }

  // Get collection info
  async getCollectionInfo() {
    try {
      const info = await qdrantClient.getCollection(this.collectionName);
      return info;
    } catch (error) {
      console.error("Error getting collection info:", error);
      throw error;
    }
  }

  // Delete a point
  async deleteKBPage(uuid: string) {
    try {
      await qdrantClient.delete(this.collectionName, {
        wait: true,
        points: [uuid],
      });
      return { success: true, uuid };
    } catch (error) {
      console.error(`Error deleting KB page ${uuid}:`, error);
      return { success: false, uuid, error: (error as Error).message };
    }
  }
}

export const qdrantService = new QdrantService();
