// server/services/qdrant.ts
import logger from "../../logger.js";
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
    logger.info("Testing Qdrant connection Again...");
    // Test connection by listing collections
    const collections = await qdrantClient.getCollections();
    logger.info("✅ Qdrant connection OK");
  } catch (error: any) {
    logger.error("❌ Failed to connect to Qdrant");
    logger.error({ err: error.message }, "Error message");
    if (error.cause) logger.error({ err: error.cause }, "Cause");
  }
}

export class QdrantService {
  private collectionName = "kb_pages";
  private closedSupportTicketsCollection = "closed_support_tickets";
  private vectorSize = 1536; // OpenAI text-embedding-3-small dimension

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
      logger.error({ err: error }, "Error initializing Qdrant collection");
      throw error;
    }
  }

  async initializeClosedSupportTicketsCollection() {
    await this.ensureCollection(this.closedSupportTicketsCollection);
  }

  // Generate embeddings from text
  async generateEmbeddings(text: string): Promise<number[]> {
    try {
      // Clean HTML content to plain text
      const cleanText = text
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: cleanText,
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error({ err: error }, "Error generating embeddings");
      throw error;
    }
  }

  // Upsert a single KB page to Qdrant
  async upsertKBPage(kbPage: any) {
    try {
      const embeddings = await this.generateEmbeddings(kbPage.body);

      const point = {
        id: kbPage.uuid, // Use UUID as point ID
        vector: embeddings,
        payload: {
          uuid: kbPage.uuid,
          title: kbPage.title,
          description: kbPage.description,
          body: kbPage.body,
          slug: kbPage.slug,
          status: kbPage.status,
          parent: kbPage.parent,
          lastEditedByUUID: kbPage.lastEditedByUUID,
          createdAt: kbPage.createdAt,
          updatedAt: kbPage.updatedAt,
          // Store clean text for better search
          cleanText: kbPage.body
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
        },
      };

      await qdrantClient.upsert(this.collectionName, {
        wait: true,
        points: [point],
      });

      return { success: true, uuid: kbPage.uuid };
    } catch (error) {
      logger.error({ err: error }, `Error upserting KB page ${kbPage.uuid}`);
      return {
        success: false,
        uuid: kbPage.uuid,
        error: (error as Error).message,
      };
    }
  }

  // Batch upsert multiple KB pages
  async batchUpsertKBPages(kbPages: any[], batchSize: number = 10) {
    const results: any[] = [];

    for (let i = 0; i < kbPages.length; i += batchSize) {
      const batch = kbPages.slice(i, i + batchSize);
      logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(kbPages.length / batchSize)}`);

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

  // Search similar pages
  async searchSimilar(query: string, limit: number = 5, filter?: any) {
    try {
      const queryEmbedding = await this.generateEmbeddings(query);

      const searchResult = await qdrantClient.search(this.collectionName, {
        vector: queryEmbedding,
        limit,
        with_payload: true,
        filter: filter || {
          must: [
            {
              key: "status",
              match: { value: "published" },
            },
          ],
        },
      });

      return searchResult.map((point) => ({
        uuid: point.payload?.uuid,
        title: point.payload?.title,
        description: point.payload?.description,
        body: point.payload?.body,
        slug: point.payload?.slug,
        score: point.score,
        cleanText: point.payload?.cleanText,
      }));
    } catch (error) {
      logger.error({ err: error }, "Error searching Qdrant");
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
      url: point.payload?.slug ? `/insight/${String(point.payload.slug)}` : undefined,
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
      logger.error({ err: error }, "Error getting collection info");
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
      logger.error({ err: error }, `Error deleting KB page ${uuid}`);
      return { success: false, uuid, error: (error as Error).message };
    }
  }
}

export const qdrantService = new QdrantService();
