import { Document, Schema, model } from "mongoose";
import AssetTag from "./assettag.js";

export interface FileAssetTagsInterface extends Document {
  fileID: Schema.Types.ObjectId;
  tags: Schema.Types.ObjectId[];
}

const FileAssetTagsSchema = new Schema<FileAssetTagsInterface>({
  fileID: {
    type: Schema.Types.ObjectId,
    ref: "File",
    required: true,
  },
  tags: {
    type: [Schema.Types.ObjectId],
    ref: AssetTag,
    required: true,
  },
});

const FileAssetTags = model<FileAssetTagsInterface>(
  "FileAssetTags",
  FileAssetTagsSchema
);

export default FileAssetTags;
