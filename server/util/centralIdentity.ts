import axios from "axios";
import { CentralIdentityVerificationRequestStatus } from "../types";

const ONE_AUTH_HEADER = `Basic ${Buffer.from(
  `${process.env.CENTRAL_IDENTITY_USER}:${process.env.CENTRAL_IDENTITY_KEY}`
).toString("base64")}`;

/**
 * @returns {boolean} True if central identity env variables are set for priveleged requests
 */
export const centralIdentityConfigured =
  process.env.CENTRAL_IDENTITY_URL &&
  process.env.CENTRAL_IDENTITY_URL.length > 0 &&
  process.env.CENTRAL_IDENTITY_USER &&
  process.env.CENTRAL_IDENTITY_USER.length > 0 &&
  process.env.CENTRAL_IDENTITY_KEY &&
  process.env.CENTRAL_IDENTITY_KEY.length > 0;

/**
 * @returns {boolean} True if central identity env variables are set for public requests
 */
export const centralIdentityPublicConfigured =
  process.env.CENTRAL_IDENTITY_URL &&
  process.env.CENTRAL_IDENTITY_URL.length > 0;

/**
 *
 * @param {boolean} publicRequest True if request is public (default true)
 * @returns {AxiosInstance} axios instance with predefined central identity url and auth header
 */
export function useCentralIdentityAxios(publicRequest = true) {
  const headersObj = publicRequest ? undefined : { authorization: ONE_AUTH_HEADER };
  const axiosInstance = axios.create({
    baseURL: process.env.CENTRAL_IDENTITY_URL,
    headers: headersObj,
  });

  return axiosInstance;
}

export function isCentralIdentityVerificationRequestStatus(
  text: string
): text is CentralIdentityVerificationRequestStatus {
  return (
    text === "approved" ||
    text === "denied" ||
    text === "needs_change" ||
    text === "open"
  );
}
