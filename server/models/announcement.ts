import { model, Model, Schema, Document } from "mongoose";

export interface AnnouncementInterface extends Document {
  author: string;
  title: string;
  message: string;
  org: string;
  expires?: Date;
}

const AnnouncementSchema: Schema<AnnouncementInterface> = new Schema(
  {
    author: {
      // announcement author (UUID)
      type: String,
      required: true,
    },
    title: {
      // announcement title
      type: String,
      required: true,
    },
    message: {
      // announcement full message
      type: String,
      required: true,
    },
    org: {
      // announcement target Organization, one of: ['global', <ORGID>, 'system']
      type: String,
      required: true,
    },
    expires: Date, // announcement expiration date (system announcements only)
  },
  {
    timestamps: true,
  }
);

const Announcement: Model<AnnouncementInterface> = model(
  "Announcement",
  AnnouncementSchema
);

export default Announcement;
