import { Express } from "express";

export interface TypedReqBody<T> extends Express.Request {
  body: T;
}

export interface TypedReqQuery<T> extends Express.Request {
  query: Partial<T>;
}

export interface TypedReqParams<T> extends Express.Request {
  params: Partial<T>;
}

export interface TypedReqParamsAndBody<T, K> extends Express.Request {
  params: Partial<T>;
  body: K;
}
