/**
 * @file Defines a Mongoose schema for storing information about external clients (and their
 *  generated keys) that have been authorized by Conductor to use its API(s). API keys for
 *  services consumed by the platform itself should not be stored in documents using this schema.
 * @author LibreTexts <info@libretexts.org>
 */

import mongoose from 'mongoose';

const APIClientSchema = new mongoose.Schema({
  /**
   * Unique internal identifier of the client.
   */
  clientID: {
    type: String,
    required: true,
    index: true,
  },
  /**
   * Hashed client secret. This value MUST NOT be exposed in public-facing code.
   */
  clientSecret: {
    type: String,
    required: true,
  },
  /**
   * Name of the client service for easier identification in UI.
   */
  name: {
    type: String,
    required: true,
  },
  /**
   * Scopes of information contained in Conductor resources that the client is
   * authorized to access.
   */
  scopes: [String],
  /**
   * Datetime the client last used their ID:SECRET pair. SHOULD be updated whenever information
   * is accessed using the pair.
   */
  lastUsed: Date,
});

const APIClient = mongoose.model('APIClient', APIClientSchema);

export default APIClient;
