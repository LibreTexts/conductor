/**
 * @file Defines a Mongoose schema for storing C-IDs, entries in the Course Identification
 *  Numbering System from the California Community Colleges Chancellor's Office.
 *  More information about C-IDs can be found at {@link https://c-id.net/}.
 * @author LibreTexts <info@libretexts.org>
 */

import mongoose from 'mongoose';

const CIDDescriptorSchema = new mongoose.Schema({
  /**
   * The C-ID descriptor.
   */
  descriptor: {
    type: String,
    required: true,
    unique: true,
  },
  /**
   * The course title.
   */
  title: {
    type: String,
    required: true,
  },
  /**
   * The course description/overview.
   */
  description: String,
  /**
   * Date the descriptor was approved by the C-ID program.
   */
  approved: Date,
  /**
   * Date after which the descriptor is no longer valid in the program.
   */
  expires: Date,
}, {
  timestamps: true,
});

const CIDDescriptor = mongoose.model('CIDDescriptor', CIDDescriptorSchema);

export default CIDDescriptor;
