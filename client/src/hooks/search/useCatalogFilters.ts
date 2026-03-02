import { useReducer } from "react";

/**
 * Generic filter reducer hook that replaces multiple identical reducer functions.
 * Handles common filter operations: set field, reset all, reset one.
 *
 * @template T - The filter type (e.g., BookFilters, AssetFilters)
 * @returns Object with filters state, dispatch function, and hasFilters boolean
 *
 * @example
 * const bookFilters = useCatalogFilters<BookFilters>();
 * bookFilters.dispatch({ type: "author", payload: "John Doe" });
 * bookFilters.dispatch({ type: "reset", payload: "" });
 */
export const useCatalogFilters = <T extends Record<string, any>>() => {
  const [filters, dispatch] = useReducer(
    (state: T, action: { type: string; payload: string }): T => {
      switch (action.type) {
        case "reset":
          return {} as T;
        case "reset_one": {
          const newState = { ...state };
          delete newState[action.payload as keyof T];
          return newState;
        }
        default:
          // Set the field with the given payload
          return { ...state, [action.type]: action.payload };
      }
    },
    {} as T
  );

  return {
    filters,
    dispatch,
    hasFilters: Object.keys(filters).length > 0,
  };
};
