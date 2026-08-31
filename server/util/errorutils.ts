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

/** Node internals that hold live handles and are always circular. Never serialize these. */
const NON_SERIALIZABLE_CONSTRUCTORS = new Set([
  "Socket",
  "TLSSocket",
  "ClientRequest",
  "IncomingMessage",
  "ServerResponse",
  "Agent",
  "HTTPParser",
  "TLSWrap",
  "TCP",
  "Timeout",
]);

/** Cap on any single serialized response body, in characters. */
const MAX_RESPONSE_DATA_LENGTH = 2000;

function isNonSerializable(value: any): boolean {
  if (typeof value === "function") return true;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) return true;
  if (typeof value !== "object" || value === null) return false;
  if (typeof value.pipe === "function") return true; // any stream
  const ctor = value.constructor?.name;
  return !!ctor && NON_SERIALIZABLE_CONSTRUCTORS.has(ctor);
}

/**
 * JSON.stringify replacer that tolerates cycles and refuses to walk into live Node handles
 * (sockets, requests, streams). Without this, serializing an AxiosError throws
 * "Converting circular structure to JSON" from inside a catch block, destroying the original error.
 */
function safeReplacer() {
  const seen = new WeakSet<object>();
  return function (this: any, _key: string, value: any) {
    if (isNonSerializable(value)) return "[NotSerializable]";
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  };
}

/**
 * Reduces an Axios error to the facts that are actually useful in a log or on a failed record:
 * what was requested, what came back, and why it failed. The raw error is never walked, because
 * `request` and a streamed `response.data` both hold a live socket.
 */
function serializeAxiosError(error: any): string {
  const responseData = error.response?.data;
  const includeData =
    !isNonSerializable(responseData) &&
    (typeof responseData === "string" ||
      (typeof responseData === "object" && responseData !== null));

  const payload: Record<string, any> = {
    name: error.name,
    message: error.message,
    code: error.code,
    status: error.response?.status,
    method: error.config?.method,
    url: error.config?.url,
  };

  if (includeData) {
    try {
      const asString =
        typeof responseData === "string"
          ? responseData
          : JSON.stringify(responseData, safeReplacer());
      payload.responseData =
        asString && asString.length > MAX_RESPONSE_DATA_LENGTH
          ? `${asString.slice(0, MAX_RESPONSE_DATA_LENGTH)}...[truncated]`
          : asString;
    } catch {
      // Deliberately ignored: the response body is a nicety, never worth failing the serialization.
    }
  }

  return JSON.stringify(payload, safeReplacer());
}

/**
 * Serializes an error object into a string representation.
 * @param error - The error object to serialize, which can be an instance of Error or any other object.
 * @returns A string representation of the error object. If the error is an instance of Error, it will include the name, message, stack trace, and any additional properties.
 * If the error is a plain object, it will be serialized as JSON.
 * For other types, it will return the string representation of the error.
 *
 * This function is total: it never throws. Callers use it from inside catch blocks, so a
 * serialization failure here would replace the real error with a useless one.
 */
export const serializeError = (error: any): string => {
  try {
    if (error && typeof error === "object" && error.isAxiosError) {
      return serializeAxiosError(error);
    }

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
      }, safeReplacer());
    } else if (typeof error === 'object' && error !== null) {
      return JSON.stringify(error, safeReplacer(), 2);
    } else {
      return String(error);
    }
  } catch (serializationError) {
    return String(error);
  }
}
