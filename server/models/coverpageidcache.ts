import { model, Schema, Document } from "mongoose";

export interface CoverPageIdCacheInterface extends Document {
  cacheKey: string;
  subdomain: string;
  coverPath: string;
  pageId: string;
  expiresAt: Date;
}

const CoverPageIdCacheSchema = new Schema<CoverPageIdCacheInterface>(
  {
    cacheKey: { type: String, required: true, unique: true },
    subdomain: { type: String, required: true },
    coverPath: { type: String, required: true },
    pageId: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

const CoverPageIdCache = model<CoverPageIdCacheInterface>(
  "CoverPageIdCache",
  CoverPageIdCacheSchema
);

export default CoverPageIdCache;
