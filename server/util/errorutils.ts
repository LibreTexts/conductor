import { Response } from "express";
import conductorErrors from "../conductor-errors.js";

/**
 * Returns error response based on provided params
 * @param {Response} res - Express Response object
 * @param {number} statusCode - HTTP status code
 * @param {string} msgKey - keyof conductorErrors
 * @returns
 */
export function conductorErr(
  res: Response,
  statusCode: number,
  msgKey: keyof typeof conductorErrors
) {
  const msgVal = conductorErrors[msgKey];
  return res.status(statusCode).send({
    err: true,
    errMsg: msgVal,
  });
}

/**
 * Returns standard 400 (bad request) error
 * @param {Response} res - Express Response object
 */
export function conductor400Err(res: Response) {
  return res.status(400).send({
    err: true,
    errMsg: conductorErrors.err1,
  });
}

/**
 * Returns standard 404 (not found) error
 * @param {Response} res - Express Response object
 */
export function conductor404Err(res: Response) {
  return res.status(404).send({
    err: true,
    errMsg: conductorErrors.err11,
  });
}

/**
 * Returns standard 500 (internal server) erro
 * @param {Response} res - Express Response object
 */
export function conductor500Err(res: Response) {
  return res.status(500).send({
    err: true,
    errMsg: conductorErrors.err6,
  });
}

/**
 * Serializes an error object into a string representation.
 * @param error - The error object to serialize, which can be an instance of Error or any other object.
 * @returns A string representation of the error object. If the error is an instance of Error, it will include the name, message, stack trace, and any additional properties.
 * If the error is a plain object, it will be serialized as JSON.
 * For other types, it will return the string representation of the error.
 */
export const serializeError = (error: any): string => {
  if (error instanceof Error) {
    return JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...Object.getOwnPropertyNames(error).reduce((acc, key) => {
        if (key !== 'name' && key !== 'message' && key !== 'stack') {
          // @ts-ignore
          acc[key] = error[key];
        }
        return acc;
      }, {})
    });
  } else if (typeof error === 'object' && error !== null) {
    return JSON.stringify(error, null, 2);
  } else {
    return String(error);
  }
}