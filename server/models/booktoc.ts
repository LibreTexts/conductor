import { model, Schema } from "mongoose";
import type { TableOfContents } from "../types/Book.js";

/**
 * A book's public (restriction-filtered) table of contents, shared by every
 * container so reader traffic is served without walking CXOne. Restricted trees
 * are never stored here. See BookService.getBookTOCNew.
 */
export interface BookTOCInterface {
  bookID: string;
  toc: TableOfContents;
  /** When the walk that produced `toc` started. */
  builtAt: Date;
  /** Last Conductor write to the book. Later than `builtAt` means stale. */
  invalidatedAt?: Date;
  /** One container at a time refreshes a stale copy; others serve it meanwhile. */
  refreshLeaseUntil: Date;
}

const BookTOCSchema = new Schema<BookTOCInterface>({
  bookID: { type: String, required: true, unique: true },
  toc: { type: Schema.Types.Mixed, required: true },
  builtAt: { type: Date, required: true },
  invalidatedAt: { type: Date },
  refreshLeaseUntil: { type: Date, default: () => new Date(0) },
});

export const BookTOC = model<BookTOCInterface>("BookTOC", BookTOCSchema, "booktocs");
