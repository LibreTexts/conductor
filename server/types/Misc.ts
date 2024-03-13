import { ITimezoneOption } from "react-timezone-select";

export type TimeZoneOption = ITimezoneOption;

export type GenericKeyTextValueObj<T> = {
  key: string;
  text: string;
  value: T;
};
