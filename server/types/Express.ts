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
export interface TypeReqParamsWithUser<T>
  extends TypedReqParams<T>,
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
