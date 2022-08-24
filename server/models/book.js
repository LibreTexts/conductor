/**
 * @file Defines a Mongoose schema for storing metadata of LibreTexts books for cataloging.
 * @author LibreTexts <info@libretexts.org>
 */

import mongoose from 'mongoose';

const MaterialsSchema = new mongoose.Schema();
MaterialsSchema.add({
  /**
   * Unique identifier of the material entry.
   */
  materialID: {
    type: String,
    required: true,
  },
  /**
   * UI-name of the material entry.
   */
  name: String,
  /**
   * Indicates which users can download the file on Commons.
   */
  access: {
    type: String,
    enum: ['public', 'users', 'mixed'],
  },
  /**
   * Indicates whether the entry is a "file" or "folder".
   */
  storageType: {
    type: String,
    enum: ['file', 'folder'],
    default: 'file',
  },
  /**
   * Entry size in bytes, set to 0 if entry is a "folder".
   */
  size: {
    type: Number,
    default: 0,
  },
  /**
   * Identifier of the immediate parent in the hierarchy. Empty string if the
   * entry is at the top-level of the hierarchy.
   */
  parent: String,
  /**
   * UUID of the user that uploaded or created the entry.
   */
  createdBy: String,
  /**
   * Number of times the entry has been downloaded on Commons, if entry is a "file".
   */
  downloadCount: Number,
});

const BookSchema = new mongoose.Schema({
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
  location: String,
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
   * Ancillary Materials associated with the Book.
   */
  materials: [MaterialsSchema],
}, {
  timestamps: true
});

BookSchema.index({
  title: 'text',
  author: 'text',
  library: 'text',
  subject: 'text',
  course: 'text',
  license: 'text',
  affiliation: 'text',
});

const Book = mongoose.model('Book', BookSchema);

export default Book;
