import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Combobox, Text } from "@libretexts/davis-react";
import api from "../../../api";
import useDebounce from "../../../hooks/useDebounce";
import useGlobalError from "../../error/ErrorHooks";
import { ProjectFileAuthor } from "../../../types";

interface PrimaryAuthorFieldProps {
  value?: ProjectFileAuthor | null;
  onChange: (author: ProjectFileAuthor) => void;
}

/**
 * Default primary author for new assets, searched from the org's authors.
 * Replaces AuthorsForm's "project-default" mode, which the file editors still use.
 */
const PrimaryAuthorField = ({ value, onChange }: PrimaryAuthorFieldProps) => {
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();
  const [search, setSearch] = useState("");

  const { data: authors, isFetching } = useQuery({
    queryKey: ["authors", "search", search],
    queryFn: async () => {
      const res = await api.getAuthors({ query: search || undefined });
      if (res.data.err) throw new Error(res.data.errMsg);
      if (!Array.isArray(res.data.items)) throw new Error("Failed to load author options");
      return res.data.items as ProjectFileAuthor[];
    },
    keepPreviousData: true,
    staleTime: 30 * 1000,
    onError: handleGlobalError,
  });

  const debouncedSearch = debounce((q: string) => setSearch(q.trim()), 250);
  const options = (authors ?? []).filter((a) => a._id && a._id !== value?._id);

  return (
    <div className="flex flex-col gap-2">
      <Combobox<ProjectFileAuthor>
        value={value ?? null}
        by="_id"
        onChange={(author) => author && onChange(author)}
      >
        <Combobox.Label>Default Primary Author</Combobox.Label>
        <Combobox.Input<ProjectFileAuthor>
          placeholder="Search authors…"
          displayValue={(a) => a?.name ?? ""}
          onChange={(e) => debouncedSearch(e.target.value)}
        />
        <Combobox.Options>
          {options.length > 0 ? (
            options.map((a) => (
              <Combobox.Option<ProjectFileAuthor> key={a._id} value={a}>
                {a.name}
              </Combobox.Option>
            ))
          ) : (
            <Combobox.Empty>{isFetching ? "Searching…" : "No matching authors."}</Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox>
      <Text as="p" size="sm" color="muted" className="m-0">
        New assets list this author first. You can change it on each file.
      </Text>
    </div>
  );
};

export default PrimaryAuthorField;
