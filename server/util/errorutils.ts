import { Response } from "express";
import conductorErrors from "../conductor-errors.js";

/**
 * Returns error response based on provided params
 * @param {Response} res - Express Response object
 * @param {number} statusCode - HTTP status code
 * @param {string} msg - keyof conductorErrors
 * @returns
 */
export function conductorErr(
  res: Response,
  statusCode: number,
  msg: keyof typeof conductorErrors
) {
  return res.status(statusCode).send({
    err: true,
    errMsg: msg,
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
