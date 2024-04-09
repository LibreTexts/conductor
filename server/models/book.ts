import { model, Schema, Document } from "mongoose";
import { ReaderResource } from "../types";

export interface BookInterface extends Document {
  bookID: string;
  title: string;
  author?: string;
  affiliation?: string;
  library: string;
  subject?: string;
  location?: string;
  course?: string;
  program?: string;
  license?: string;
  thumbnail?: string;
  summary?: string;
  rating?: number;
  links?: {
    online?: string;
    pdf?: string;
    buy?: string;
    zip?: string;
    files?: string;
    lms?: string;
  };
  lastUpdated?: string;
  libraryTags?: string[];
  readerResources: ReaderResource[];
}

const BookSchema = new Schema<BookInterface>(
  {
    /**
     * LibreTexts standard text identifier in the format 'library-coverPageID'.
     */
    bookID: {
      type: String,
      required: true,
      unique: true,
    },
    /**
     * Full Book title.
     */
    title: {
      type: String,
      required: true,
    },
    /**
     * Book author's name.
     */
    author: String,
    /**
     * Book author's affiliation/institution.
     */
    affiliation: String,
    /**
     * Book library (standard LibreTexts shortened format).
     */
    library: {
      type: String,
      required: true,
    },
    /**
     * Book's "shelf"/subject.
     */
    subject: String,
    /**
     * The Book's location in LibreTexts (i.e. Central Bookshelves or Campus Bookshelves).
     */
    location: {
      type: String,
      index: true,
    },
    /**
     * The course or campus the Book belongs to.
     */
    course: String,
    /**
     * The OER program the book belongs to.
     */
    program: String,
    /**
     * The Book's license identifier.
     */
    license: String,
    /**
     * URL of the Book's thumbnail.
     */
    thumbnail: String,
    /**
     * The Book's overview/description/summary.
     */
    summary: String,
    /**
     * The overall quality, on a scale of 0-5. Value is the average of all Peer Review
     * overall ratings submitted on the Book.
     */
    rating: {
      type: Number,
      min: 0,
      max: 5,
    },
    /**
     * Links to access the Book in different formats.
     */
    links: {
      /**
       * Book's live library URL.
       */
      online: String,
      /**
       * Book PDF export URL.
       */
      pdf: String,
      /**
       * URL to purchase on LibreTexts Bookstore.
       */
      buy: String,
      /**
       * Book ZIP file export URL.
       */
      zip: String,
      /**
       * Book print/publication files URL.
       */
      files: String,
      /**
       * Book LMS/Common Cartrige export URL.
       */
      lms: String,
    },
    /**
     * ISO timestamp of the most recent (page-level) update within the Book.
     */
    lastUpdated: String,
    /**
     * Meta-tags from the respective library attached to the Book.
     */
    libraryTags: [String],
    /**
     * Reader Resources (external links to other resources/materials) attached to the Book.
     */
    readerResources: [
      {
        name: String,
        url: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

BookSchema.index({
  title: "text",
  author: "text",
  affiliation: "text",
  library: "text",
  subject: "text",
  location: "text",
  course: "text",
  program: "text",
  license: "text",
  summary: "text",
  libraryTags: "text",
});

BookSchema.index({
  location: 1,
  program: 1,
});

const Book = model<BookInterface>("Book", BookSchema);

export default Book;
