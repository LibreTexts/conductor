/**
 * @file Defines a Mongoose schema for storing information about external clients (and their
 *  generated keys) that have been authorized by Conductor to use its API(s). API keys for
 *  services consumed by the platform itself should not be stored in documents using this schema.
 * @author LibreTexts <info@libretexts.org>
 */

import { model, Schema, Document } from "mongoose";
export interface APIClientInterface extends Document {
  clientID: string;
  clientSecret: string;
  name: string;
  infoURL: string;
  icon: string;
  grants: string[];
  redirectURI?: string;
  scopes?: string[];
  scopesLastUpdated?: Date;
  lastUsed?: Date;
  accessTokenLifetime?: number;
  refreshTokenLifetime?: number;
}

const APIClientSchema = new Schema<APIClientInterface>({
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
   * A URL with information about the API Client or its producer.
   */
  infoURL: {
    type: String,
    required: true,
  },
  /**
   * URL of an icon (image download) representing the API Client.
   */
  icon: {
    type: String,
    required: true,
  },
  /**
   * OAuth grant types allowed for the client.
   */
  grants: {
    type: [String],
    required: true,
  },
  /**
   * Redirect URI for use in AuthCode OAuth flow.
   */
  redirectURI: String,
  /**
   * Scopes of information contained in Conductor resources that the client is
   * authorized to access, in the format ACCESS:SET:RESOURCE.
   */
  scopes: [String],
  /**
   * Datetime the client's authorized scopes were updated. Changes to this
   * value trigger a reconsent for OAuth flows.
   */
  scopesLastUpdated: Date,
  /**
   * Datetime the client last used their ID:SECRET pair. SHOULD be updated whenever information
   * is accessed using the pair.
   */
  lastUsed: Date,
  /**
   * Time (in seconds) that an AccessToken issued for this client is valid for.
   */
  accessTokenLifetime: Number,
  /**
   * Time (in seconds) that a RefreshToken issued for this client is valid for.
   */
  refreshTokenLifetime: Number,
});

const APIClient = model<APIClientInterface>(
  "APIClient",
  APIClientSchema
);

export default APIClient;
