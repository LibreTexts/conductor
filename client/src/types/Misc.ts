import { ITimezoneOption } from "react-timezone-select";

export type GenericKeyTextValueObj<T> = {
  key: string;
  text: string;
  value: T;
};

export type TimeZoneOption = ITimezoneOption;

export type MongoBaseDocument = {
  _id?: string;
  __v?: any;
};

export type ConductorBaseResponse =
  | { err: false }
  | { err: true; errMsg: string };