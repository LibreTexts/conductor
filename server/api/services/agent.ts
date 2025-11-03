// server/api/services/agent.ts
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { StateGraph, END, START, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { z } from 'zod';
import { qdrantService } from './qdrant.js';
import AgentHistory from '../../models/agenthistory.js';
import {
  SYSTEM_PROMPTS,
  TOOL_PROMPTS,
  ERROR_MESSAGES,
  buildSystemPrompt,
} from './prompts.js';
import axios from 'axios';

export interface AgentSource {
  number: number;
  title: string;
  description: string;
  slug?: string;
  url: string;
  relevanceScore?: number;
  source: 'kb' | 'web';
}

export interface AgentResponse {
  response: string;
  sources: AgentSource[];
  query: string;
  timestamp: string;
}

export class AgentService {
  private llm: ChatOpenAI;
  private readonly CONFIDENCE_THRESHOLD = 0.5;

  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4-turbo-preview',
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

    return sessionId;
  }

  /**
   * Load chat history from database
   */
  private async loadChatHistory(sessionId: string): Promise<BaseMessage[]> {
    const session = await AgentHistory.findOne({ sessionId });

    if (!session || !session.messages || session.messages.length === 0) {
      return [];
    }

    return session.messages.map((msg: any) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else {
        return new AIMessage(msg.content);
      }
    });
  }

  /**
   * Save messages to database
   */
  private async saveMessages(sessionId: string, userMessage: string, aiMessage: string) {
    await AgentHistory.updateOne(
      { sessionId },
      {
        $push: {
          messages: [
            { role: 'user', content: userMessage },
            { role: 'agent', content: aiMessage },
          ],
        },
        $set: { 'metadata.lastActivity': new Date() },
        $inc: { 'metadata.totalQueries': 1 },
      }
    );
  }

  /**
   * Google Search Tool using Serper API
   */
  private createGoogleSearchTool() {
    return new DynamicStructuredTool({
      name: TOOL_PROMPTS.googleSearch.name,
      description: TOOL_PROMPTS.googleSearch.description,
      schema: z.object({
        query: z.string().describe('The search query to send to Google'),
      }),
      func: async ({ query }) => {
        try {
          console.log(`🔍 Google Search: "${query}"`);

          if (!process.env.SERPER_API_KEY) {
            return 'Google Search is not available (API key not configured)';
          }

          const response = await axios.post(
            'https://google.serper.dev/search',
            {
              q: query,
              num: 5, // Get top 5 results
            },
            {
              headers: {
                'X-API-KEY': process.env.SERPER_API_KEY,
                'Content-Type': 'application/json',
              },
            }
          );

          const results = response.data.organic || [];
          
          if (results.length === 0) {
            return 'No results found on Google for this query.';
          }

          const formattedResults = results
            .map((result: any, idx: number) => {
              return `[${idx + 1}] ${result.title}\n${result.snippet}\nURL: ${result.link}`;
            })
            .join('\n\n');

          const output = `Google Search Results:\n\n${formattedResults}`;
      
          // 👇 ADD THIS - Log the tool output
          console.log('📤 Google Search Output:');
          console.log(output);
          console.log('─'.repeat(80));

          return `Google Search Results:\n\n${formattedResults}`;
        } catch (error: any) {
          console.error('Google Search error:', error.message);
          return `Error searching Google: ${error.message}`;
        }
      },
    });
  }

  /**
   * Vector Search Tool using Qdrant
   */
  private createVectorSearchTool() {
    return new DynamicStructuredTool({
      name: TOOL_PROMPTS.knowledgeBase.name,
      description: TOOL_PROMPTS.knowledgeBase.description,
      schema: z.object({
        query: z.string().describe('The search query to find relevant KB articles'),
        limit: z.number().optional().default(3).describe('Number of results to return (default: 3)'),
      }),
      func: async ({ query, limit = 3 }) => {
        try {
          console.log(`📚 KB Search: "${query}" (limit: ${limit})`);

          const results = await qdrantService.searchSimilar(query, limit);

          if (results.length === 0) {
            return 'No relevant articles found in the LibreTexts Knowledge Base.';
          }

          const formattedResults = results
            .map((result, idx) => {
              const cleanText = result.cleanText || (result.body as string)?.replace(/<[^>]*>/g, ' ').substring(0, 500);
              return `[${idx + 1}] ${result.title}\n${result.description || ''}\nContent: ${cleanText}...\nURL: /insight/${result.slug}\nRelevance Score: ${result.score?.toFixed(3)}`;
            })
            .join('\n\n');

            const output = `Knowledge Base Results:\n\n${formattedResults}`;
        
            // 👇 ADD THIS - Log the tool output
            console.log('📤 KB Search Output:');
            console.log(output);
            console.log('─'.repeat(80));

          return `Knowledge Base Results:\n\n${formattedResults}`;
        } catch (error: any) {
          console.error('KB Search error:', error.message);
          return `Error searching Knowledge Base: ${error.message}`;
        }
      },
    });
  }

  /**
   * Determine if the agent should continue or end
   */
  private shouldContinue(state: typeof MessagesAnnotation.State) {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];

    // If the last message has tool calls, continue to execute tools
    if (lastMessage._getType() === 'ai' && (lastMessage as any).tool_calls?.length) {
      return 'tools';
    }

    // Otherwise, end the conversation
    return END;
  }

  /**
   * Call the LLM with tools
   */
  private async callModel(state: typeof MessagesAnnotation.State) {
    const messages = state.messages;
    const response = await this.llm.invoke(messages);
    return { messages: [response] };
  }

  /**
   * Query with LangGraph Agent
   */
  async queryWithLangGraph(
    query: string,
    sessionId: string,
    systemPrompt: string = buildSystemPrompt({ tone: 'default', includeHistory: true })
  ): Promise<AgentResponse> {
    try {
      console.log(`🤖 LangGraph Agent Query: "${query}" [Session: ${sessionId}]`);

      // Load chat history
      const chatHistory = await this.loadChatHistory(sessionId);

      // Create tools
      const tools = [this.createVectorSearchTool(), this.createGoogleSearchTool()];

      // Bind tools to LLM
      const modelWithTools = this.llm.bindTools(tools);

      // Create tool node
      const toolNode = new ToolNode(tools);

      // Create the graph
      const workflow = new StateGraph(MessagesAnnotation)
        .addNode('agent', async (state) => {
          const messages = state.messages;
          const response = await modelWithTools.invoke(messages);
          return { messages: [response] };
        })
        .addNode('tools', toolNode)
        .addEdge(START, 'agent')
        .addConditionalEdges('agent', this.shouldContinue)
        .addEdge('tools', 'agent');

      const app = workflow.compile();

      // Prepare initial messages
      const initialMessages: BaseMessage[] = [
        new HumanMessage(systemPrompt),
        ...chatHistory,
        new HumanMessage(query),
      ];

      // Execute the graph
      const finalState = await app.invoke({
        messages: initialMessages,
      });

      // Extract the final response
      const messages = finalState.messages;
      const lastMessage = messages[messages.length - 1];
      const aiResponse = lastMessage.content as string;

      // Extract sources from tool calls
      const sources = this.extractSources(messages);

      // Save to database
      await this.saveMessages(sessionId, query, aiResponse);

      console.log('✅ Agent response generated');

      return {
        response: aiResponse,
        sources,
        query,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('❌ LangGraph Agent error:', error);
      throw error;
    }
  }

  /**
   * Extract sources from tool calls in messages
   */
  private extractSources(messages: BaseMessage[]): AgentSource[] {
    const sources: AgentSource[] = [];
    let sourceNumber = 1;

    for (const message of messages) {
      if (message._getType() === 'tool') {
        const toolMessage = message as any;
        const content = toolMessage.content;

        // Parse KB sources
        if (content.includes('Knowledge Base Results:')) {
          const kbMatches = content.matchAll(/\[(\d+)\] (.+?)\n.*?URL: (.+?)\n/g);
          for (const match of kbMatches) {
            sources.push({
              number: sourceNumber++,
              title: match[2],
              description: '',
              url: match[3],
              source: 'kb',
            });
          }
        }

        // Parse Google sources
        if (content.includes('Google Search Results:')) {
          const googleMatches = content.matchAll(/\[(\d+)\] (.+?)\n.*?URL: (.+?)(?:\n|$)/g);
          for (const match of googleMatches) {
            sources.push({
              number: sourceNumber++,
              title: match[2],
              description: '',
              url: match[3],
              source: 'web',
            });
          }
        }
      }
    }

    return sources;
  }

  /**
   * Backward compatibility: queryWithTools method
   */
  async queryWithTools(
    query: string,
    sessionId: string,
    collectionName: string = 'kb_pages',
    systemPrompt: string = 'You are a helpful AI assistant for LibreTexts Knowledge Base.',
    limit: number = 3
  ): Promise<string> {
    const response = await this.queryWithLangGraph(query, sessionId, systemPrompt);
    return response.response;
  }

  async getGraphVisualization(): Promise<string> {
    try {
      // Create tools
      const tools = [this.createVectorSearchTool(), this.createGoogleSearchTool()];
      
      // Bind tools to LLM
      const modelWithTools = this.llm.bindTools(tools);
      
      // Create tool node
      const toolNode = new ToolNode(tools);
      
      // Create the graph (same as in queryWithLangGraph)
      const workflow = new StateGraph(MessagesAnnotation)
        .addNode('agent', async (state) => {
          const messages = state.messages;
          const response = await modelWithTools.invoke(messages);
          return { messages: [response] };
        })
        .addNode('tools', toolNode)
        .addEdge(START, 'agent')
        .addConditionalEdges('agent', this.shouldContinue)
        .addEdge('tools', 'agent');
      
      const app = workflow.compile();
      
      // Get the graph structure as Mermaid
      const graph = app.getGraph();
      const mermaidString = graph.drawMermaid();
      
      return mermaidString;
    } catch (error: any) {
      console.error('Error generating graph visualization:', error);
      throw error;
    }
  }

  async exportGraphToFile(filename: string = 'agent-graph.mmd'): Promise<void> {
    const mermaid = await this.getGraphVisualization();
    const fs = await import('fs/promises');
    await fs.writeFile(filename, mermaid, 'utf-8');
    console.log(`✅ Graph exported to ${filename}`);
    console.log('View it at: https://mermaid.live/');
  }
}

export const agentService = new AgentService();