import { model, Schema, Document } from "mongoose";

export interface SessionInterface extends Document {
  sessionId: string;
  userId: string;
  sessionTicket?: string;
  createdAt: Date;
  expiresAt: Date;
  valid: boolean;
}

const SessionSchema = new Schema<SessionInterface>({
  sessionId: { type: String, required: true },
  userId: { type: String, required: true },
  sessionTicket: { type: String },
  createdAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  valid: { type: Boolean, required: true },
});

SessionSchema.index({ sessionId: 1 }, { unique: true });
SessionSchema.index({ userId: 1 });


const Session = model<SessionInterface>("Session", SessionSchema);
export default Session;
