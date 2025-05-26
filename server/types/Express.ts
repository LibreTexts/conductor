import { Express } from "express";
import { UserInterface } from "../models/user";

/**
 * The extracted User object from the JWT
 */
export interface TypedReqUser {
  decoded: {
    uuid: string;
    iat: number;
    exp: number;
  };
  roles: { _id: string; org: string; role: string }[];
}

export type ZodReqWithUser<T> = T &  { user: TypedReqUser };
export type ZodReqWithOptionalUser<T> = T & { user?: TypedReqUser };
export type ZodReqWithFiles<T> = T & { files: Express.Multer.File[] };

/**
 * Basic req with extracted User;
 * (only suitable for authenticated endpoints)
 */
export interface TypedReqWithUser extends Express.Request {
  user: TypedReqUser;
}

/**
 * Req with body of type T
 * @type {T} T - The type interface of the body object
 */
export interface TypedReqBody<T> extends Express.Request {
  body: T;
}

/**
 * Req with body of type T and extracted User
 * (only suitable for authenticated endpoints)
 * @type {T} T - The type interface of the body object
 */
export interface TypedReqBodyWithUser<T>
  extends TypedReqBody<T>,
    TypedReqWithUser {}

/**
 * Req with query object of type T
 * @type {T} - The type interface of the query object
 */
export interface TypedReqQuery<T> extends Express.Request {
  query: Partial<T>;
}

/**
 * Req with query object of type T and extracted User
 * (only suitable for authenticated endpoints)
 * @type {T} T - The type interface of the query object
 */
export interface TypedReqQueryWithUser<T>
  extends TypedReqQuery<T>,
    TypedReqWithUser {}

/**
 * Req with query object of type T
 * @type {T} T - The type interface of the query object
 */
export interface TypedReqParams<T> extends Express.Request {
  params: Partial<T>;
}

/**
 * Req with params object of type T and extracted User
 * (only suitable for authenticated endpoints)
 * @type {T} T - The type interface of the params object
 */
export interface TypedReqParamsWithUser<T>
  extends TypedReqParams<T>,
    TypedReqWithUser {}



/**
 * Req with params object of type T and query object of type K
 * @type {T} T - The type interface of the params object
 * @type {K} K - The type interface of the query object
 */
export interface TypedReqParamsAndQuery<T, K>
  extends TypedReqParams<T>,
    TypedReqQuery<K> {}

/**
 * Req with params object of type T and query object of type K and extracted User
 * (only suitable for authenticated endpoints)
 * @type {T} T - The type interface of the params object
 * @type {K} K - The type interface of the query object
 */
export interface TypedReqParamsAndQueryWithUser<T, K>
  extends TypedReqParams<T>,
    TypedReqQuery<K>,
    TypedReqWithUser {}

/**
 * Req with param object of type T and body object of type K
 * @type {T} T - The type interface of the params object
 * @type {K} T - The type interface of the body object
 */
export interface TypedReqParamsAndBody<T, K>
  extends TypedReqParams<T>,
    TypedReqBody<K> {}

/**
 * Req with param object of type T and body object of type K and extracted User
 * (only suitable for authenticated endpoints)
 * @type {T} T - The type interface of the params object
 * @type {K} T - The type interface of the body object
 */
export interface TypedReqParamsAndBodyWithUser<T, K> extends TypedReqWithUser {
  params: Partial<T>;
  body: K;
}

export interface ConductorErrResponse {
  err: boolean,
  errMsg: string,
}
