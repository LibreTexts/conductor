// server/services/qdrant.ts
import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';

const qdrantUrl =
  process.env.QDRANT_URL ||
  process.env.QDRANT_HOST ||
  'http://localhost:6333';

const qdrantClient = new QdrantClient({
  url: 'https://qdrant-dev-duqf9.ondigitalocean.app',               // keep https, no :6333 for DO
  apiKey: 'd7efef04-2336-425f-aae7-f32c5a267594',
  port: 443,
});

console.log('qdrantUrl', qdrantUrl);
console.log('qdrantClient', qdrantClient);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

console.log('Testing Qdrant connection...');

async function testQdrantConnection() {
    try {
        console.log('Testing Qdrant connection Again...');
      // Test connection by listing collections
      const collections = await qdrantClient.getCollections();
      console.log('✅ Qdrant connection OK');
    } catch (error: any) {
      console.error('❌ Failed to connect to Qdrant');
      console.error('Error message:', error.message);
      if (error.cause) console.error('Cause:', error.cause);
    }
  }
  
  // Run connection test
  await testQdrantConnection();

export class QdrantService {
  private collectionName = 'kb_pages';
  private vectorSize = 1536; // OpenAI text-embedding-3-small dimension

  // Initialize Qdrant collection
  async initializeCollection() {
    try {
      // Check if collection exists
      console.log('Checking if collection exists ...');
      const collections = await qdrantClient.getCollections();
      console.log('collections', collections);
      const collectionExists = collections.collections.some(
        col => col.name === this.collectionName
      );
      console.log('collectionExists', collectionExists);

      if (!collectionExists) {
        console.log(`Creating Qdrant collection: ${this.collectionName}`);
        
        await qdrantClient.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine', // Use cosine similarity
          },
          optimizers_config: {
            default_segment_number: 2,
          },
          replication_factor: 1,
        });

        console.log('Collection created successfully');
      } else {
        console.log('Collection already exists');
      }

      return true;
    } catch (error) {
      console.error('Error initializing Qdrant collection:', error);
      throw error;
    }
  }

  // Generate embeddings from text
  async generateEmbeddings(text: string): Promise<number[]> {
    try {
      // Clean HTML content to plain text
      const cleanText = text
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: cleanText,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embeddings:', error);
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
          cleanText: kbPage.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
        },
      };

      await qdrantClient.upsert(this.collectionName, {
        wait: true,
        points: [point],
      });

      return { success: true, uuid: kbPage.uuid };
    } catch (error) {
      console.error(`Error upserting KB page ${kbPage.uuid}:`, error);
      return { success: false, uuid: kbPage.uuid, error: (error as Error).message };
    }
  }

  // Batch upsert multiple KB pages
  async batchUpsertKBPages(kbPages: any[], batchSize: number = 10) {
    const results: any[] = [];
    
    for (let i = 0; i < kbPages.length; i += batchSize) {
      const batch = kbPages.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(kbPages.length/batchSize)}`);

      const batchPromises = batch.map(page => this.upsertKBPage(page));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            uuid: batch[index].uuid,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });

      // Add delay to avoid rate limiting
      if (i + batchSize < kbPages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
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
              key: 'status',
              match: { value: 'published' }
            }
          ]
        },
      });

      return searchResult.map(point => ({
        uuid: point.payload?.uuid,
        title: point.payload?.title,
        description: point.payload?.description,
        body: point.payload?.body,
        slug: point.payload?.slug,
        score: point.score,
        cleanText: point.payload?.cleanText,
      }));
    } catch (error) {
      console.error('Error searching Qdrant:', error);
      throw error;
    }
  }

  // Get collection info
  async getCollectionInfo() {
    try {
      const info = await qdrantClient.getCollection(this.collectionName);
      return info;
    } catch (error) {
      console.error('Error getting collection info:', error);
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