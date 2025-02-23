import { ITimezoneOption } from "react-timezone-select";

export type TimeZoneOption = ITimezoneOption;

export type GenericKeyTextValueObj<T> = {
  key: string;
  text: string;
  value: T;
};

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
