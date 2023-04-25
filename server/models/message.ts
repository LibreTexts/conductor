import { model, Model, Schema, Document } from "mongoose";
export interface MessageInterface extends Document {
  messageID: string;
  thread?: string;
  task?: string;
  body: string;
  author: string;
}

const MessageSchema: Schema<MessageInterface> = new Schema(
  {
    messageID: {
      // base62 15-digit identifier
      type: String,
      required: true,
      unique: true,
    },
    thread: {
      // the threadID the message belongs to (if applicable)
      type: String,
    },
    task: {
      type: String, // the taskID the message belongs to (if applicable)
    },
    body: {
      // the message body
      type: String,
      required: true,
    },
    author: {
      type: String, // the UUID of the message sender
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Message: Model<MessageInterface> = model("Message", MessageSchema);

export default Message;
