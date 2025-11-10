/**
 * @file Defines handlers for OAuth2 Server capabilities to authenticate and
 *  authorize external API Clients.
 * @author LibreTexts <info@libretexts.org>
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import OAuth2Server, {
  OAuthError,
  Request,
  Response
} from '@node-oauth/oauth2-server';
import AccessToken from '../models/accesstoken.js';
import AuthCode from '../models/authcode.js';
import RefreshToken from '../models/refreshtoken.js';
import apiClients from './apiclients.js';
import users from './users.js';
import scopes from '../util/scopes.js';
import { isValidDateObject } from '../util/helpers.js';
import conductorErrors from '../conductor-errors.js';

/* Default token lifetimes */
const ACCESS_TOKEN_LIFETIME = 3600; // seconds
const REFRESH_TOKEN_LIFETIME = 86400; // seconds

/**
 * An API Client as represented in the context of an OAuth flow.
 * @typedef {object} OAuthClient
 * @property {string} id - Identifier of the API Client.
 */

/**
 * A user as represented in the context of an OAuth client.
 * @typedef {object} OAuthUser
 * @property {string} id - Unique identifier of the User.
 */

/**
 * Saves a new AccessToken and RefreshToken to the database.
 *
 * @param {object} token - The tokens to be saved.
 * @param {string} token.accessToken - Access token to be saved.
 * @param {Date} token.accessTokenExpiresAt - The expiry time of the access token.
 * @param {string} token.refreshToken - Refresh token to be saved.
 * @param {Date} token.refreshTokenExpiresAt - The expiry time of the refresh token.
 * @param {string} token.scope - Scope(s) authorized for the tokens.
 * @param {OAuthClient} client - The API Client associated with the tokens.
 * @param {OAuthUser} user - The user associated with the token.
 * @returns {Promise<object>} Newly saved tokens and associated data.
 */
async function saveToken(token, client, user) {
  const newToken = new AccessToken({
    token: token.accessToken,
    expiresAt: token.accessTokenExpiresAt,
    issued: new Date(),
    scope: token.scope,
    clientID: client.id,
    user: user.id,
  });
  const newRefresh = new RefreshToken({
    token: token.refreshToken,
    expiresAt: token.refreshTokenExpiresAt,
    issued: new Date(),
    scope: token.scope,
    clientID: client.id,
    user: user.id,
  });
  await Promise.all([newToken.save(), newRefresh.save()]);
  if (user.isNewAuth) {
    users.addUserAuthorizedApplication(user.id, client.id);
  }
  return {
    accessToken: newToken.token,
    accessTokenExpiresAt: newToken.expiresAt,
    refreshToken: newRefresh.token,
    refreshTokenExpiresAt: newRefresh.expiresAt,
    scope: newToken.scope,
    refresh_expires_in: Math.floor((newRefresh.expiresAt - new Date()) / 1000), // custom attribute
    client: { id: newToken.clientID },
    user: { id: newToken.user },
  }
}

/**
 * Saves a new AuthCode to the database.
 *
 * @param {object} code - The code to be saved.
 * @param {string} code.authorizationCode - The code value to be saved.
 * @param {Date} code.expiresAt - Expiry time of the code.
 * @param {string} code.redirectUri - Redirect URI associated with the code.
 * @param {string} code.scope - Scope(s) authroized for the code.
 * @param {OAuthClient} client - The API Client associated with the code.
 * @param {OAuthUser} user - The user associated with the code.
 * @returns {Promise<object>} Informationa aout the code.
 */
async function saveAuthorizationCode(code, client, user) {
  const newAuthCode = new AuthCode({
    code: code.authorizationCode,
    expiresAt: code.expiresAt,
    issued: new Date(),
    redirectURI: code.redirectUri,
    /* ignore scope from request, always use server-provided value to stay spec-compliant */
    scope: client.scope,
    clientID: client.id,
    user: user.id,
    isNewAuth: user.isNewAuth,
  });
  await newAuthCode.save();
  return {
    authorizationCode: newAuthCode.code,
    expiresAt: newAuthCode.expiresAt,
    redirectUri: newAuthCode.redirectURI,
    scope: newAuthCode.scope,
    client: { id: newAuthCode.clientID },
    user: {
      id: newAuthCode.user,
      isNewAuth: newAuthCode.isNewAuth,
      scopesUpdatedSinceAuth: user.scopesUpdatedSinceAuth,
    },
  }
}

/**
 * Retrieves an existing AccessToken from the database.
 *
 * @param {String} accessToken - Access token value to lookup.
 * @returns {Promise<object>} Information about the found token. 
 */
async function getAccessToken(accessToken) {
  const foundToken = await AccessToken.findOne({ token: accessToken }).lean();
  if (!foundToken) {
    return null;
  }
  return {
    accessToken: foundToken.token,
    accessTokenExpiresAt: foundToken.expiresAt,
    scope: foundToken.scope,
    client: { id: foundToken.clientID },
    user: { id: foundToken.user },
  }
}

/**
 * Retrieves an AuthCode from the database.
 *
 * @param {string} authorizationCode - Authorization code value to lookup.
 * @returns {Promise<object>} Information about the found code.
 */
async function getAuthorizationCode(authorizationCode) {
  const foundCode = await AuthCode.findOne({ code: authorizationCode }).lean();
  if (!foundCode) {
    return null;
  }
  return {
    code: foundCode.code,
    authorizationCode: foundCode.code, // oauth2-server seems to use both names?
    expiresAt: foundCode.expiresAt,
    redirectUri: foundCode.redirectURI,
    scope: foundCode.scope,
    client: { id: foundCode.clientID },
    user: {
      id: foundCode.user,
      isNewAuth: foundCode.isNewAuth,
    },
  }
}

/**
 * Retreives an API Client from the database and verifies the provided secret, if necessary.
 *
 * @param {string} clientID - Identifier of the client to lookup.
 * @param {string} [clientSecret] - Client secret, if required by the grant type. 
 * @returns {Promise<object|boolean>} Information about the client, or false if no match found.
 */
async function getClient(clientID, clientSecret) {
  const foundClient = await apiClients.getAPIClientInternal(clientID);
  if (!foundClient) {
    return null;
  }
  if (clientSecret) {
    const match = await bcrypt.compare(clientSecret, foundClient.clientSecret);
    if (!match) {
      return null;
    }
  }

  const redirectURI = foundClient.redirectURI || '';
  const hasCustomAccessLifetime = Object.prototype.hasOwnProperty.call(
    foundClient,
    'accessTokenLifetime',
  );
  const hasCustomRefreshLifetime = Object.prototype.hasOwnProperty.call(
    foundClient,
    'refreshTokenLifetime',
  );

  return {
    id: foundClient.clientID,
    redirectUris: [redirectURI],
    grants: foundClient.grants,
    scope: foundClient.scopes.join(' '),
    accessTokenLifetime: hasCustomAccessLifetime ? foundClient.accessTokenLifetime : ACCESS_TOKEN_LIFETIME,
    refreshTokenLifetime: hasCustomRefreshLifetime ? foundClient.refreshTokenLifetime : REFRESH_TOKEN_LIFETIME,
    scopesLastUpdated: foundClient.scopesLastUpdated,
  }
}

/**
 * Retrieves a RefreshToken from the database.
 *
 * @param {string} refreshToken - The refresh token value to lookup.
 * @returns {Promise<object>} Information about the found token.
 */
async function getRefreshToken(refreshToken) {
  const foundRefresh = await RefreshToken.findOne({ token: refreshToken }).lean();
  if (!foundRefresh) {
    return null;
  }
  return {
    refreshToken: foundRefresh.token,
    refreshTokenExpiresAt: foundRefresh.expiresAt,
    scope: foundRefresh.scope,
    client: { id: foundRefresh.clientID },
    user: { id: foundRefresh.user },
  }
}

/**
 * Revokes a RefreshToken by deleting it from the database.
 *
 * @param {object} token - The token to be revoked.
 * @param {string} token.refreshToken - The token value.
 * @returns {Promise<boolean>} True if successfully revoked, false otherwise.
 */
async function revokeToken(token) {
  const delToken = await RefreshToken.deleteOne({ token: token.refreshToken }).lean();
  if (delToken.deletedCount !== 1) {
    return false;
  }
  return true;
}

/**
 * Revokes an AuthCode by deleting it from the database.
 *
 * @param {object} code - The code to be revoked.
 * @param {string} code.code - The authorization code value.
 * @returns {Promise<boolean>} True if successfully revoked, false otherwise.
 */
async function revokeAuthorizationCode(code) {
  const delCode = await AuthCode.deleteOne({ code: code.code }).lean();
  if (delCode.deletedCount !== 1) {
    return false;
  }
  return true;
}

/**
 * Verifies that an API Client has access to the endpoint/scope it is requesting.
 *
 * @param {object} accessToken - The provided access token issued to the API Client.
 * @param {string} accessToken.scope - A space-delimited string of scopes the API Client
 *  has access to.
 * @param {string} scope - The scope identifier corresponding to the current request.
 * @returns {boolean} True if the API Client has access, false otherwise.
 */
function verifyScope(accessToken, scope) {
  let clientScopes = [];
  if (typeof (accessToken.scope) === 'string') {
    clientScopes = accessToken.scope.split(' ');
  }
  return clientScopes.includes(scope);
}

/**
 * Class representing a "server" handling OAuth flows within Conductor,
 * wired to handle Express-type requests from the API.
 */
class ConductorOAuthServer {
  /**
   * Creates a new instance of the OAuth server.
   *
   * @param {object} opts - Options to pass to the OAuth2 server library.
   * @param {object} opts.model - Collection of handlers for OAuth2-related actions,
   *  as outlined by {@link https://oauth2-server.readthedocs.io/en/latest/model/spec.html}
   */
  constructor(opts) {
    this.server = new OAuth2Server(opts);
  }

  /**
   * Authenticates a request that uses credentials obtained from an OAuth2 flow
   * 
   * @returns {function} An Express-type middleware function.
   */
  async authenticate(req, res, next) {
    const serverScope = this;
    try {
      const request = new Request(req);
      const response = new Response(res);
      const token = await serverScope.server.authenticate(request, response, {
        scope: scopes.getEndpointAsScope(req.route.path, req.method),
      });
      req.user = {
        authSource: 'oauth',
        decoded: {
          uuid: token.user.id,
        },
      };
      req.decoded = { uuid: token.user.id }; // TODO: Remove and update other handlers
      apiClients.updateAPIClientLastUsed(token.client.id);
      return next();
    } catch (e) {
      return serverScope.handleOAuthError(res, e);
    }
  }

  /**
   * Begins an OAuth2 token flow by retrieving the User of the current session, generating an
   * auth code, and, if necessary, redirecting the user-agent.
   *
   * @returns {function} An Express-type middleware function.
   */
  authorize() {
    const serverScope = this;
    return async function (req, res) {
      try {
        const request = new Request(req);
        const response = new Response(res);
        const code = await serverScope.server.authorize(request, response, {
          authenticateHandler: {
            handle: async function (authReq) {
              const id = authReq.user.decoded.uuid;
              const authorizedApps = await users.getUserAuthorizedApplications(id);
              const clientID = authReq.body.client_id || authReq.query.client_id;
              const foundClient = await apiClients.getAPIClientInternal(clientID);
              const foundApp = authorizedApps.find((app) => app.clientID === clientID);
              let scopesUpdatedSinceAuth = false;
              if (
                foundApp
                && isValidDateObject(foundApp.authorizedAt)
                && isValidDateObject(foundClient.scopesLastUpdated)
              ) {
                if (foundApp.authorizedAt < foundClient.scopesLastUpdated) {
                  scopesUpdatedSinceAuth = true; // show consent screen again
                }
              }
              const isNewAuth = !foundApp || scopesUpdatedSinceAuth;
              return {
                id,
                authorizedApps,
                isNewAuth,
                scopesUpdatedSinceAuth,
              }
            },
          },
        });
        apiClients.updateAPIClientLastUsed(code.client.id);
        return serverScope.handleOAuthResponse(res, response);
      } catch (e) {
        return serverScope.handleOAuthError(res, e);
      }
    }
  }

  /**
   * Exchanges an authorization grant by validating the provided grant,
   * client identity, and client secret.
   *
   * @returns {function} An Express-type middleware function.
   */
  token() {
    const serverScope = this;
    return async function (req, res) {
      try {
        const request = new Request(req);
        const response = new Response(res);
        const token = await serverScope.server.token(request, response);
        apiClients.updateAPIClientLastUsed(token.client.id);
        return serverScope.handleOAuthResponse(res, response);
      } catch (e) {
        return serverScope.handleOAuthError(res, e);
      }
    }
  }

  /**
   * Handles errors during an OAuth2 flow by setting appropriate status codes and error messages,
   * then closing the request/response pipeline.
   *
   * @param {express.Response} res - The initial HTTP response object.
   * @param {OAuthError} e - The flow error to process. 
   * @returns {express.Response} A consumed HTTP response object, with error handled.
   */
  handleOAuthError(res, e) {
    let status = 400;
    let errMsg = conductorErrors.err6;
    let expiredToken = false;
    let expiredGrant = false;
    switch (e.name) {
      case 'invalid_argument':
        status = 500;
        errMsg = conductorErrors.err6;
        break;
      case 'invalid_grant':
        status = 401;
        errMsg = conductorErrors.err69;
        expiredGrant = true;
        break;
      case 'invalid_token':
        status = 401;
        errMsg = conductorErrors.err70;
        expiredToken = true;
        break;
      case 'invalid_request':
        status = 400;
        errMsg = conductorErrors.err1;
        break;
      case 'invalid_client':
      case 'unauthorized_client':
        status = 400;
        errMsg = conductorErrors.err8;
        break;
      case 'insufficient_scope':
        status = 403;
        errMsg = conductorErrors.err8;
        break;
      default:
        console.error(e);
    }
    return res.status(status).send({
      err: true,
      errMsg,
      ...(expiredToken && { expired_token: true }),
      ...(expiredGrant && { expired_grant: true }),
    });
  }

  /**
   * Handles OAuth2 flow success by setting appropriate response headers and closing the pipeline.
   *
   * @param {express.Response} res - The initial HTTP response object. 
   * @param {Response} response - The OAuth2 server generated response.
   * @returns {express.Response} A consumed HTTP response object, with necessary
   *  headers and redirects added.
   */
  handleOAuthResponse(res, response) {
    if (response.status === 302) {
      const location = response.headers.location;
      delete response.headers.location;
      res.set(response.headers);
      return res.redirect(location);
    }
    res.set(response.headers);
    return res.status(response.status).send(response.body);
  }
}

const OAuthServerInstance = new ConductorOAuthServer({
  allowExtendedTokenAttributes: true,
  model: {
    saveToken,
    saveAuthorizationCode,
    getAccessToken,
    getAuthorizationCode,
    getClient,
    getRefreshToken,
    revokeToken,
    revokeAuthorizationCode,
    verifyScope,
  },
});

export default OAuthServerInstance;
