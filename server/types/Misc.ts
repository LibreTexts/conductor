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
}