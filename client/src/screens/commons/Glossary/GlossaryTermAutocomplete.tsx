import { useEffect, useState } from "react";
import {
  Control,
  Controller,
  FieldPath,
  FieldValues,
  RegisterOptions,
} from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { IconLoader2 } from "@tabler/icons-react";
import classNames from "classnames";
import useDebounce from "../../../hooks/useDebounce";
import api from "../../../api";

type GlossaryTermAutocompleteProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  control: Control<TFieldValues>;
  name: TName;
  rules?: RegisterOptions<TFieldValues, TName>;
  label?: string;
  placeholder?: string;
  onSelect?: (value: string) => void;
};

const GlossaryTermAutocomplete = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  rules,
  label = "Term",
  placeholder = "Search glossary terms...",
  onSelect,
}: GlossaryTermAutocompleteProps<TFieldValues, TName>) => {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { value, onChange, onBlur, ref }, fieldState: { error } }) => (
        <GlossaryTermAutocompleteField
          inputRef={ref}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          onBlur={onBlur}
          onSelect={onSelect}
          label={label}
          placeholder={placeholder}
          required={!!rules?.required}
          error={!!error}
          errorMessage={error?.message}
        />
      )}
    />
  );
};

type GlossaryTermAutocompleteFieldProps = {
  inputRef: React.Ref<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onSelect?: (value: string) => void;
  label: string;
  placeholder: string;
  required?: boolean;
  error: boolean;
  errorMessage?: string;
};

const GlossaryTermAutocompleteField = ({
  inputRef,
  value,
  onChange,
  onBlur,
  onSelect,
  label,
  placeholder,
  required,
  error,
  errorMessage,
}: GlossaryTermAutocompleteFieldProps) => {
  const [query, setQuery] = useState(value);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { debounce } = useDebounce();

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const updateDebouncedQuery = debounce((nextQuery: string) => {
      setDebouncedQuery(nextQuery.trim());
    }, 300);
    updateDebouncedQuery(query);
  }, [query, debounce]);

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["glossary-term-search", debouncedQuery],
    queryFn: async () => {
      const res = await api.searchGlossary(debouncedQuery);
      if (res.err) return [];
      return res.data ?? [];
    },
    enabled: debouncedQuery.length >= 1,
    keepPreviousData: true,
  });

  const showSuggestions = isOpen && query.trim().length >= 1;

  const handleInputChange = (nextValue: string) => {
    setQuery(nextValue);
    onChange(nextValue);
    setIsOpen(true);
  };

  const handleSelect = (term: string) => {
    setQuery(term);
    onChange(term);
    setIsOpen(false);
    onSelect?.(term);
  };

  return (
    <div className="relative">
      <label className="block text-sm/6 font-medium text-gray-900">
        {label}{required ? "*" : ""}
      </label>
      <div className="relative mt-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showSuggestions}
          aria-autocomplete="list"
          className={classNames(
            "block w-full rounded-md bg-white py-2 px-3 pr-10 text-base text-gray-900 outline-1 -outline-offset-1 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 sm:text-sm/6",
            error
              ? "outline-red-500 focus:outline-red-500"
              : "outline-gray-300 focus:outline-indigo-600"
          )}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              const trimmed = query.trim();
              if (trimmed) handleSelect(trimmed);
            }
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 150);
            onBlur();
          }}
        />
        {/* {isLoading && (
          <IconLoader2
            className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 animate-spin text-gray-400"
            aria-hidden="true"
          />
        )} */}
      </div>

      {errorMessage && (
        <p className="mt-1 text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      )}

      {showSuggestions && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg outline outline-black/5 sm:text-sm"
        >
          {isLoading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-gray-500">Searching...</li>
          )}
          {!isLoading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-gray-500">No matching terms</li>
          )}
          {suggestions.map((term) => (
            <li key={term}>
              <button
                type="button"
                role="option"
                className="block w-full cursor-pointer truncate px-3 py-2 text-left text-gray-900 hover:bg-gray-50 focus:bg-gray-100 focus:outline-none"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(term)}
              >
                {term}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default GlossaryTermAutocomplete;
