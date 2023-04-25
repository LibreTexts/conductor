import { model, Model, Schema, Document } from "mongoose";

export enum AlertResource {
  PROJECT = "project",
  BOOK = "book",
  HOMEWORK = "homework",
}

export interface AlertInterface extends Document {
  orgID: string;
  alertID: string;
  user: string;
  query: string;
  timing: "instant" | "daily";
  resources: AlertResource[];
  projectLocation?: "global" | "local";
  lastTriggered?: Date;
}

const AlertSchema: Schema<AlertInterface> = new Schema(
  {
    orgID: {
      // the OrgID of the instance the Alert was created in
      type: String,
      required: true,
    },
    alertID: {
      // base62 17-digit identifier
      type: String,
      required: true,
      unique: true,
    },
    user: {
      // the UUID of the user the Alert belongs to
      type: String,
      required: true,
    },
    query: {
      // the phrase to search for matching results with
      type: String,
      required: true,
    },
    timing: {
      // how often to check for new results, one of ['instant', 'daily']
      type: String,
      required: true,
    },
    resources: {
      // the resource types to match, some of ['project', 'book', 'homework']
      type: [String],
      required: true,
      enum: AlertResource,
    },
    projectLocation: String, // one of ['global', 'local']
    lastTriggered: Date, // timestamp when the alert was last 'triggered'
  },
  {
    timestamps: true,
  }
);

const Alert: Model<AlertInterface> = model("Alert", AlertSchema);
export default Alert;
