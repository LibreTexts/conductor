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

// Case-insensitive uniqueness (collation strength 2) so "Cell" and "cell"
// can't end up as two separate terms with two different termIDs — the DB is
// the actual guard against that race; see glossary-service.ts's
// _addGlossaryToDatabase for the atomic upsert that relies on it.
GlossarySchema.index(
  { term: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

const Glossary = model<GlossaryInterface>("Glossary", GlossarySchema);

export default Glossary;