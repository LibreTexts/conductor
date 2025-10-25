// // server/api/services/agent.ts
// import OpenAI from 'openai';
// import { qdrantService } from './qdrant.js';

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY!,
// });

// export interface AgentSource {
//   number: number;
//   title: string;
//   description: string;
//   slug: string;
//   url: string;
//   relevanceScore?: number;
// }

// export interface AgentResponse {
//   response: string;
//   sources: AgentSource[];
//   query: string;
//   timestamp: string;
// }

// export class AgentService {
  
//   /**
//    * Generic RAG agent that works with any Qdrant collection
//    * @param query - User's question
//    * @param collectionName - Qdrant collection to search (e.g., 'kb_pages', 'projects', 'books')
//    * @param systemPrompt - Custom system prompt for the agent
//    * @param limit - Number of results to retrieve (default: 3)
//    */
//   async query(
//     query: string,
//     collectionName: string = 'kb_pages',
//     systemPrompt: string = 'You are a helpful AI agent. Answer questions based on the provided context.',
//     limit: number = 3
//   ): Promise<AgentResponse> {
    
//     console.log(`🤖 Agent Query: "${query}" [Collection: ${collectionName}]`);

//     // Step 1: Vector search in Qdrant
//     console.log('🔍 Step 1: Searching for similar content...');
//     const similarPages = await qdrantService.searchSimilar(query, limit);
    
//     if (similarPages.length === 0) {
//       return {
//         response: "I couldn't find any relevant information to answer your question. Please try rephrasing or contact support for assistance.",
//         sources: [],
//         query: query,
//         timestamp: new Date().toISOString()
//       };
//     }

//     console.log(`✅ Found ${similarPages.length} relevant items`);
//     similarPages.forEach((page, i) => {
//       console.log(`  ${i + 1}. ${page.title} (score: ${page.score?.toFixed(3)})`);
//     });

//     // Step 2: Build context from retrieved content
//     console.log('📝 Step 2: Building context...');
//     const context = this.buildContext(similarPages);

//     // Step 3: Generate prompt
//     const prompt = this.buildPrompt(context, query);

//     // Step 4: Call LLM
//     console.log('🤖 Step 3: Generating response with LLM...');
//     const aiResponse = await this.generateResponse(prompt, systemPrompt);
    
//     console.log('✅ Response generated successfully');

//     // Step 5: Format sources
//     const sources = this.formatSources(similarPages);

//     return {
//       response: aiResponse,
//       sources,
//       query,
//       timestamp: new Date().toISOString()
//     };
//   }

//   /**
//    * Build context string from retrieved documents
//    */
//   private buildContext(documents: any[]): string {
//     return documents
//       .map((doc, idx) => {
//         const cleanText = doc.cleanText || doc.body?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || '';
//         return `[Source ${idx + 1}: ${doc.title}]\n${cleanText.substring(0, 1500)}`;
//       })
//       .join('\n\n---\n\n');
//   }

//   /**
//    * Build prompt for LLM
//    */
//   private buildPrompt(context: string, query: string): string {
//     return `Context from Knowledge Base:
// ${context}

// User Question: ${query}

// Instructions:
// - Provide a clear, accurate answer based on the context above
// - If the context contains the answer, explain it in a helpful way
// - If the context doesn't fully answer the question, say what information is available
// - Include specific steps or instructions when relevant
// - Be concise but thorough
// - Reference which source(s) you're using if helpful

// Answer:`;
//   }

//   /**
//    * Generate response using OpenAI
//    */
//   private async generateResponse(prompt: string, systemPrompt: string): Promise<string> {
//     const completion = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         {
//           role: "system",
//           content: systemPrompt
//         },
//         {
//           role: "user",
//           content: prompt
//         }
//       ],
//       temperature: 0.7,
//       max_tokens: 500,
//     });

//     return completion.choices[0].message.content || "I apologize, but I couldn't generate a response. Please try again.";
//   }

//   /**
//    * Format sources for response
//    */
//   private formatSources(documents: any[]): AgentSource[] {
//     return documents.map((doc, idx) => ({
//       number: idx + 1,
//       title: doc.title,
//       description: doc.description || '',
//       slug: doc.slug,
//       url: `/insight/${doc.slug}`,
//       relevanceScore: doc.score
//     }));
//   }

//   /**
//    * Streaming agent responses (for future real-time responses)
//    */
//   async queryStream(
//     query: string,
//     collectionName: string = 'kb_pages',
//     systemPrompt: string = 'You are a helpful AI agent.',
//     limit: number = 3
//   ) {
//     // Placeholder for streaming implementation
//     // You can implement SSE (Server-Sent Events) here later
//     throw new Error('Streaming not yet implemented');
//   }
// }

// export const agentService = new AgentService();







import { ChatOpenAI } from '@langchain/openai';
import { ConversationChain } from 'langchain/chains';
import { BufferMemory } from 'langchain/memory';
import { MongoDBChatMessageHistory } from "@langchain/mongodb";
import { PromptTemplate } from '@langchain/core/prompts';
import { qdrantService } from './qdrant.js';
import AgentHistory from '../../models/agenthistory.js';
import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';
import { ChatMessageHistory } from "langchain/memory";
import { Runnable } from "langchain/schema/runnable";


export class AgentService {
    private llm: ChatOpenAI;
    private readonly CONFIDENCE_THRESHOLD = 0.5;
  
    constructor () {
      this.llm = new ChatOpenAI({
        modelName: 'gpt-4.1',
        temperature: 0.7,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
    }
  
    /**
     * Create a new session
     */
    async createSession(userId?: string): Promise<string> {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await AgentHistory.create({
        sessionId,
        userId,
        messages: [],
        metadata: {
          collectionName: 'kb_pages',
          totalQueries: 0,
          lastActivity: new Date(),
        },
      });
  
      console.log(`✅ Created session: ${sessionId}`);
      return sessionId;
    }

    /**
   * Get LangChain memory with MongoDB chat history
   */
  private async getMemoryWithMongoDB(sessionId: string): Promise<BufferMemory> {

    const chatHistory = new ChatMessageHistory();
     
    const memory = new BufferMemory({
      chatHistory,
      returnMessages: true,
      memoryKey: 'chat_history',
    });
    
    // Load existing messages from AgentHistory
    const session = await AgentHistory.findOne({ sessionId });
    
    if (session && session.messages && session.messages.length > 0) {
        // Manually restore chat history
        for (const msg of session.messages) {
        if (msg.role === 'user') {
            await memory.chatHistory.addUserMessage(msg.content);
        } else if (msg.role === 'agent') {
            await memory.chatHistory.addAIChatMessage(msg.content);
        }
        }
    }
    return memory;
  }

  async queryWithTools(
  query: string,
  sessionId: string,
  collectionName: string = 'kb_pages',
  systemPrompt: string = 'You are a helpful AI assistant for LibreTexts Knowledge Base. Answer questions based on the provided context.',
  limit: number = 3
): Promise<string> {
  console.log(`🤖 Agent Query: "${query}" [Session: ${sessionId}]`);

  // Step 1: Retrieve memory
  const memory = await this.getMemoryWithMongoDB(sessionId);
  console.log('Retrieved chat memory:', memory);
  const memoryVariables = await memory.loadMemoryVariables({});
  const chatHistory = memoryVariables.chat_history.map((msg: any) => {
    return msg.role === 'user' ? `User: ${msg.content}` : `Agent: ${msg.content}`;
  }).join('\n');

//   // Step 2: Combine prior context with the current query
  
  const enhancedQuery = `Conversation so far:\n${chatHistory}\n\nUser's current question: ${query}`;
  console.log(`Enhanced Query for Vector Search:\n${enhancedQuery}`);

//   // Step 3: Search the vector database for relevant context
  console.log('Searching vector database for relevant context...');
  const similarPages = await qdrantService.searchSimilar(enhancedQuery, limit);

  if (similarPages.length === 0) {
    return "I couldn't find any relevant information to answer your question. Please try rephrasing or contact support for assistance.";
  }

  console.log(`Found ${similarPages.length} relevant items`);
  const context = similarPages
    .map((doc, idx) => `[Source ${idx + 1}: ${doc.title}]\n${doc.body}`)
    .join('\n\n---\n\n');

  console.log("context:", context);
//   // Step 4: Build the prompt
  const prompt = new PromptTemplate({
    template: `Context from Knowledge Base:
        {context}

        // User Question: {query}

        // Instructions:
        // - Provide a clear, accurate answer based on the context above
        // - If the context contains the answer, explain it in a helpful way
        // - If the context doesn't fully answer the question, say what information is available
        // - Include specific steps or instructions when relevant
        - Use plain text formatting. Avoid bold text, special characters, or unnecessary indentation.
        - Write the response in simple, numbered points if applicable.


        // Answer:`,
    inputVariables: ['context', 'query'],
  });

  const formattedPrompt = await prompt.format({ context, query });

//   // Step 5: Use the LLM to generate a response
  console.log('Generating response with LLM...');
  const response = await this.llm.invoke(formattedPrompt);
  // console.log("LLM Response:", response);

//   // Step 6: Save the interaction to memory
  await AgentHistory.updateOne(
    { sessionId },
    {
      $push: {
        messages: [
          { role: 'user', content: query },
          { role: 'agent', content: response.content },
        ],
      },
      $set: { 'metadata.lastActivity': new Date() },
    }
  );

  return response.content as string;
}
}
  
export const agentService = new AgentService();