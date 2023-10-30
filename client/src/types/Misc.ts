import { ITimezoneOption } from "react-timezone-select";

export type GenericKeyTextValueObj<T> = {
  key: string;
  text: string;
  value: T;
};

export type TimeZoneOption = ITimezoneOption;

export type AtlasSearchHighlight = {
  path: string;
  score: number;
  text: { value: string, type: string }[];
};