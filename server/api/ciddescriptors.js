/**
 * @file Defines methods for interacting with stored C-ID Descriptors.
 * @author LibreTexts <info@libretexts.org>
 */

import Promise from 'bluebird';
import express from 'express';
import axios from 'axios';
import { parse } from 'csv-parse';
import CIDDescriptor from '../models/ciddescriptor.js';
import { debugError } from '../debug.js';
import conductorErrors from '../conductor-errors.js';
import { isValidDateObject } from '../util/helpers.js';

/**
 * Retrieves a list of C-ID descriptors from the C-ID program's website, then parses the data
 * and saves the descriptors to Conductor's database.
 *
 * @returns {Promise<boolean>} True if operation succeeded, false otherwise.
 */
async function syncCIDDescriptors() {
  const COLUMN_MAPPINGS = ['cid', 'title', 'approved', 'expires', 'description'];
  try {
    // get current CSV
    const rawFile = await axios.get('https://c-id.net/descriptors/final/csv', {
      responseType: 'text',
    });
    if (rawFile.status !== 200 || !rawFile.data) {
      throw (new Error('Error downloading file.'));
    }

    // parse CSV records
    const foundEntries = await Promise.fromCallback(
      (callback) => parse(rawFile.data, { columns: COLUMN_MAPPINGS }, callback),
      { multiArgs: true },
    ).spread((records) => records);
    if (foundEntries.length < 1) {
      throw (new Error('No descriptor entries found.'));
    }

    const parseEntryDate = (dateString) => {
      if (typeof (dateString) !== 'string') {
        return null;
      }
      const splitDate = dateString.split('/');
      if (splitDate.length !== 3) {
        return null;
      }
      const month = Number.parseInt(splitDate[0]);
      const day = Number.parseInt(splitDate[1]);
      const year = Number.parseInt(splitDate[2]);
      const isValid = !Number.isNaN(month) && !Number.isNaN(day) && !Number.isNaN(year);
      if (!isValid) {
        return null;
      }
      return new Date(year, month - 1, day);
    };

    // validate records and transform to DB model format
    const updateOps = foundEntries.map((item) => {
      const approveDate = parseEntryDate(item.approved);
      const expireDate = parseEntryDate(item.expires);
      if (!isValidDateObject(approveDate) || !isValidDateObject(expireDate)) {
        return null;
      }
      return {
        updateOne: {
          filter: {
            descriptor: item.cid,
          },
          update: {
            $setOnInsert: {
              descriptor: item.cid,
            },
            $set: {
              title: item.title,
              description: item.description,
              approved: approveDate,
              expires: expireDate,
            },
          },
          upsert: true,
        },
      };
    }).filter((item) => item !== null);

    // save new descriptors/updates
    const cidWrite = await CIDDescriptor.bulkWrite(updateOps, { ordered: false });
    if (cidWrite.result?.writeErrors?.length > 0) {
      cidWrite.result.writeErrors.forEach((error) => {
        debugError(`Error during CIDDescriptor DB operation: ${error.errmsg}`);
      });
    }
  } catch (err) {
    debugError('Error occurred while syncing C-ID Descriptors:');
    debugError(err.toString());
    return false;
  }
  return true;
}

/**
 * Runs the `syncCIDDescriptors` job on trigger from an automated requester
 * (e.g., the LibreTexts scheduler service).
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function runAutomatedSyncCIDDescriptors(_req, res) {
  const success = await syncCIDDescriptors();
  if (!success) {
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err72,
    });
  }
  return res.send({
    err: false,
    msg: 'Successfully synced C-ID Descriptors!',
  });
}

/**
 * Retrieves all stored C-ID Descriptors.
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getCIDDescriptors(_req, res) {
  try {
    const descriptors = await CIDDescriptor.aggregate([
      {
        $sort: {
          descriptor: 1,
        },
      }, {
        $project: {
          _id: 0,
          __v: 0,
        },
      },
    ]);

    return res.send({
      descriptors,
      err: false,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

export default {
  syncCIDDescriptors,
  runAutomatedSyncCIDDescriptors,
  getCIDDescriptors,
}
