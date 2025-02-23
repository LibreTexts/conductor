import { ITimezoneOption } from "react-timezone-select";
import { ProjectFile } from "./Project";

export type GenericKeyTextValueObj<T> = {
  key: string;
  text: string;
  value: T;
};

export type TimeZoneOption = ITimezoneOption;

export type AtlasSearchHighlight = {
  path: string;
  score: number;
  texts: { value: string; type: "hit" | "text" }[];
};

export type MongoBaseDocument = {
  _id?: string;
  __v?: any;
};

export type ConductorBaseResponse =
  | { err: false }
  | { err: true; errMsg: string };

export type _MoveFile = Pick<
  ProjectFile,
  "fileID" | "name" | "storageType" | "description"
>;
export type _MoveFileWithChildren = _MoveFile & {
  children: _MoveFileWithChildren[];
  disabled: boolean;
};

export type CloudflareCaptionData = {
  language: string;
  label: string;
};

export type SortDirection = "ascending" | "descending";

export type License = {
  name?: string;
  url?: string;
  version?: string;
  sourceURL?: string;
  modifiedFromSource?: boolean;
  additionalTerms?: string;
};

/**
 * A TypeScript type alias called `Prettify`.
 * It takes a type as its argument and returns a new type that has the same properties as the original type,
 * but the properties are not intersected. This means that the new type is easier to read and understand.
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
