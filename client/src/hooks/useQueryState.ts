import { useCallback } from "react";
import { useHistory, useLocation } from "react-router-dom";
import qs from "qs";

type CoerceOptions = "string" | "number" | "boolean";
type T = string | number | boolean;

type QueryStateOptions = {
  defaultValue?: T;
  coerce?: CoerceOptions;
};

export function useQueryState<T>(
  key: string,
  opts?: QueryStateOptions
): [T, (value: T) => void] {
  const location = useLocation();
  const history = useHistory();

  const setQuery = useCallback(
    (value: T) => {
      const existingQueries = qs.parse(location.search, {
        ignoreQueryPrefix: true,
      });

      const queryString = qs.stringify(
        { ...existingQueries, [key]: value },
        { skipNulls: true }
      );

      history.push(`${location.pathname}?${queryString}`);
    },
    [history, location, key]
  );

  const decoded = qs.parse(location.search, {
    decoder: function decoderFunction(v: any) {
      if (!v && opts?.defaultValue) return opts.defaultValue as T;
      if (!opts?.coerce) return v as T;

      if (opts.coerce === "string") {
        return (v: string) => v as string;
      }
      if (opts.coerce === "number") {
        return (v: string) => Number(v) as number;
      }
      if (opts.coerce === "boolean") {
        return (v: string) => (v === "true") as boolean;
      }
    },
    ignoreQueryPrefix: true,
  })[key] as T;

  return [decoded, setQuery];
}
