import { Document, model, Schema } from "mongoose";

export interface GlossaryInterface extends Document {
  term: string;
  definition: string;
  slug: string;
  termID: string;
  aliasesIDs?: string[];
}

const GlossarySchema = new Schema<GlossaryInterface>(
    {
        term: {
            type: String,
            required: true,
        },
        definition: {
            type: String,
            required: false,
        },
        slug: {
            type: String,
            required: true,
        },  
        termID: {
            type: String,
            required: true,
        },
        aliasesIDs: {
            type: [String],
            required: false,
        },
    }
);

const Glossary = model<GlossaryInterface>("Glossary", GlossarySchema);

export default Glossary;