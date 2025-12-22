// server/models/agenthistory.ts
import { Schema, model, Document } from 'mongoose';

export interface AgentMessageInterface {
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  confidence?: number;
  sources?: Array<{
    title: string;
    slug: string;
    url: string;
  }>;
}

export interface AgentHistoryInterface extends Document {
  sessionId: string;
  userId?: string;
  messages: AgentMessageInterface[];
  metadata: {
    collectionName: string;
    totalQueries: number;
    lastActivity: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const AgentHistorySchema = new Schema<AgentHistoryInterface>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      index: true,
    },
    messages: [
      {
        role: {
          type: String,
          enum: ['user', 'agent'],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        confidence: Number,
        sources: [
          {
            title: String,
            slug: String,
            url: String,
          },
        ],
      },
    ],
    metadata: {
      collectionName: {
        type: String,
        default: 'kb_pages',
      },
      totalQueries: {
        type: Number,
        default: 0,
      },
      lastActivity: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Auto-update lastActivity on save
AgentHistorySchema.pre('save', function (next) {
  this.metadata.lastActivity = new Date();
  next();
});

export default model<AgentHistoryInterface>('AgentHistory', AgentHistorySchema);