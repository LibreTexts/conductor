import { Document, Schema, model } from "mongoose";

export type AssetTagValueType = "short-text" | "long-text" | "number" | "date" | "boolean" | "dropdown";

export interface AssetTagInterface extends Document {
    title: string;
    valueType: AssetTagValueType;
    defaultValue?: string | number | boolean | Date;
    options?: {
        key?: string;
        value?: string | number;
        text?: string;
    }[];
    isDeleted: boolean;
}

const AssetTagSchema = new Schema<AssetTagInterface>({
    title: {
        type: String,
        required: true,
    },
    valueType: {
        type: String,
        required: true,
    },
    defaultValue: {
        type: Schema.Types.Mixed,
        required: false,
    },
    options: {
        type: [Schema.Types.Mixed],
        required: false,
    },
    isDeleted: {
        type: Boolean,
        required: true,
        default: false,
    },
});

const AssetTag = model<AssetTagInterface>("AssetTag", AssetTagSchema);

export default AssetTag;