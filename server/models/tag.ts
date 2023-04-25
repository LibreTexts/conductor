import { model, Model, Document, Schema } from "mongoose";

export interface TagInterface extends Document {
  orgID?: string;
  tagID?: string;
  title?: string;
}

const TagSchema: Schema<TagInterface> = new Schema(
  {
    /**
     * Organization identifier string.
     */
    orgID: String,
    /**
     * Base62 12-digit unique identifier.
     */
    tagID: String,
    /**
     * Tag's UI-title/display text.
     */
    title: String,
  },
  {
    timestamps: true,
  }
);

TagSchema.index({
  title: "text",
});

const Tag: Model<TagInterface> = model("Tag", TagSchema);

export default Tag;
