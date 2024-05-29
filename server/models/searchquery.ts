import { Document, Schema, model } from "mongoose";

export interface SearchQueryInterface_Raw {
  query: string;
  scope: string;
  timestamp: Date;
}

export interface SearchQueryInterface
  extends Document,
    SearchQueryInterface_Raw {}

const SearchQuerySchema = new Schema<SearchQueryInterface>(
  {
    query: {
      type: String,
      required: true,
    },
    scope: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
    },
  },
);

const SearchQuery = model<SearchQueryInterface>(
  "SearchQuery",
  SearchQuerySchema
);

export default SearchQuery;
