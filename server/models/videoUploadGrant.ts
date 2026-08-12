import { model, Schema, Document } from "mongoose";

/**
 * Records a server-authorized Cloudflare Stream upload slot. A grant is created
 * when an authenticated project member requests a direct-creator upload URL, and
 * is claimed when the resulting video is attached to a Project File. Unclaimed
 * grants are swept (along with their Cloudflare videos) by the cleanup job.
 */
export interface VideoUploadGrantInterface extends Document {
  videoID: string; // Cloudflare Stream media id
  projectID: string;
  createdBy: string; // user uuid
  maxDurationSeconds: number;
  uploadLength: number; // bytes, as sent to Cloudflare
  claimed: boolean;
  createdAt: Date;
  expiresAt: Date;
}

const VideoUploadGrantSchema = new Schema<VideoUploadGrantInterface>({
  videoID: { type: String, required: true },
  projectID: { type: String, required: true },
  createdBy: { type: String, required: true },
  maxDurationSeconds: { type: Number, required: true },
  uploadLength: { type: Number, required: true },
  claimed: { type: Boolean, required: true, default: false },
  createdAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});

VideoUploadGrantSchema.index({ videoID: 1 }, { unique: true });
VideoUploadGrantSchema.index({ projectID: 1, createdBy: 1 });
VideoUploadGrantSchema.index({ claimed: 1, createdAt: 1 });

// Reap stale grant records after the cleanup job has had its chance to run.
VideoUploadGrantSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const VideoUploadGrant = model<VideoUploadGrantInterface>(
  "VideoUploadGrant",
  VideoUploadGrantSchema
);
export default VideoUploadGrant;
