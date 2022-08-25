/**
 * @file Defines a Mongoose schema for storing "tags" that label Projects for further
 *  classification and identification.
 * @author LibreTexts <info@libretexts.org>
 */

import mongoose from 'mongoose';

const TagSchema = new mongoose.Schema({
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
}, {
  timestamps: true
});

TagSchema.index({
  title: 'text',
});

const Tag = mongoose.model('Tag', TagSchema);

export default Tag;
