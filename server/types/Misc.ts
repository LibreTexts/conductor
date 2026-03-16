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

export type ConductorInfiniteScrollResponse<T> = ({
  err: false;
} & BaseConductorInfiniteScrollResponse<T>) | {
  err: true;
  errMsg: string;
};

/**
 * The base data structure for responses from the Conductor server when fetching items with infinite scroll pagination.
 * The controller method should return data in the `ConductorInfiniteScrollResponse` format which wraps this base structure and adds an `err` field to indicate success or failure of the request.
 * This type is used to ensure consistent response formats across different API endpoints that implement infinite scroll pagination.
 */
export type BaseConductorInfiniteScrollResponse<T> = {
  items: T[];
  meta: {
    total_count: number;
    has_more: boolean;
    next_page: string | number | null;
  }
}


/**
 * A TypeScript type alias called `Prettify`.
 * It takes a type as its argument and returns a new type that has the same properties as the original type,
 * but the properties are not intersected. This means that the new type is easier to read and understand.
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type Subtract<T, K> = Omit<T, keyof K>;