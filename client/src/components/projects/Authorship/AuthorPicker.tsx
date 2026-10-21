import { useEffect, useState } from "react";
import { Badge, Button, Combobox, Stack } from "@libretexts/davis-react";
import { useQuery } from "@tanstack/react-query";
import api from "../../../api";
import type { AuthorSearchResult } from "../../../types";

interface AuthorPickerProps {
  label?: string;
  /** Called with the chosen author, or null when "Clear author" is used. */
  onSelect: (author: AuthorSearchResult | null) => void;
  onCancel?: () => void;
  /** Offer "Clear author" (removes the page's author@ tag). */
  allowClear?: boolean;
  disabled?: boolean;
}

/** Picks an author or group by name or key, using the public author search. */
const AuthorPicker = ({
  label = "Author",
  onSelect,
  onCancel,
  allowClear = true,
  disabled,
}: AuthorPickerProps) => {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["author-search", debounced],
    queryFn: async () => (await api.searchAuthors(debounced, 20)).authors,
    // The search needs at least two characters.
    enabled: debounced.length >= 2,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });

  return (
    <Stack direction="vertical" gap="xs" className="w-full">
      <Combobox<AuthorSearchResult>
        value={null}
        onChange={(author) => author && onSelect(author)}
        by="nameKey"
        nullable
        disabled={disabled}
      >
        <Combobox.Label>{label}</Combobox.Label>
        <Combobox.Input<AuthorSearchResult>
          placeholder="Search authors by name or key…"
          displayValue={() => ""}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Combobox.Options>
          {results.map((a) => (
            <Combobox.Option<AuthorSearchResult> key={a.nameKey} value={a}>
              <span className="flex items-center gap-2">
                <span>{a.name}</span>
                <span className="font-mono text-xs text-gray-500">{a.nameKey}</span>
                {a.isGroup && <Badge label="Group" size="sm" variant="primary" />}
              </span>
            </Combobox.Option>
          ))}
          <Combobox.Empty>
            {debounced.length < 2
              ? "Type at least two characters."
              : isFetching
                ? "Searching…"
                : "No matching authors."}
          </Combobox.Empty>
        </Combobox.Options>
      </Combobox>
      {(allowClear || onCancel) && (
        <Stack direction="horizontal" gap="xs">
          {allowClear && (
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => onSelect(null)}>
              Clear author
            </Button>
          )}
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
};

export default AuthorPicker;
