/**
 * @file Defines functions for working with the API Client paradigm.
 * @author LibreTexts <info@libretexts.org>
 */

import express from 'express';
import { param } from 'express-validator';
import APIClient from '../models/apiclient.js';
import scopes from '../util/scopes.js';
import conductorErrors from '../conductor-errors.js';

/**
 * Internal utility to retrieve ALL information about an API Client.
 * This method should NOT be exposed to the Conductor API.
 *
 * @param {string} clientID - Internal identifier of the API Client.
 * @returns {Promise<object|null>} API Client information, or null if not found.
 */
async function getAPIClientInternal(clientID) {
  const foundClient = await APIClient.findOne({ clientID }).lean();
  if (!foundClient) {
    return null;
  }
  return foundClient;
}

/**
 * Retrieves non-sensitive information about an API Client application.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getAPIClient(req, res) {
  const { clientID } = req.params;
  const foundClient = await APIClient.findOne({ clientID }, {
    _id: 0,
    clientID: 1,
    name: 1,
    infoURL: 1,
    icon: 1,
    scopes: 1,
  }).lean();
  if (!foundClient) {
    return res.status(404).send({
      err: true,
      errMsg: conductorErrors.err11,
    });
  }
  return res.status(200).send({
    err: false,
    msg: 'Successfully retrieved API Client!',
    client: {
      ...foundClient,
      scopeDescriptions: scopes.getScopeDescriptions(foundClient.scopes),
    },
  });
}

/**
 * Updates an API Client's key database entry with the current datetime in its 'lastUsed' field.
 *
 * @param {string} clientID - Internal identifier of the API Client.
 * @returns {void} Returns nothing, errors are logged.
 */
function updateAPIClientLastUsed(clientID) {
  if (typeof (clientID) !== 'string') {
    return;
  }
  APIClient.updateOne({ clientID }, { lastUsed: new Date() }).catch((e) => {
    console.warn('Error updating APIClient Last Used time:');
    console.warn(e);
  });
}

/**
 * Middleware(s) to validate requests contain necessary and/or valid fields.
 *
 * @param {string} method - Method name to validate request for.
 */
function validate(method) {
  switch (method) {
    case 'getAPIClient':
      return [
        param('clientID', conductorErrors.err1).exists().isString({ min: 1 }),
      ]
  }
}

export default {
  getAPIClientInternal,
  getAPIClient,
  updateAPIClientLastUsed,
  validate,
}