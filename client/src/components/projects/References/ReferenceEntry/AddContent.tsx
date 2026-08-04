import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Modal,
  Select,
  Spinner,
  Stack,
  Tabs,
  Text,
  Tooltip,
} from "@libretexts/davis-react";
import {
  BIBTEX_FIELDS_BY_TYPE,
  EntryType,
  ReferenceEntry,
  ReferenceFieldKey,
  ReferenceFormData,
  emptyReferenceForm,
  formatCitationPreview,
  getBibtexFieldLabel,
  ReferenceFormatType,
  EntryTypes,
} from "../model";
import ImportBibtexDialog from "../ImportBibtexDialog";
import api from "../../../../api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DataTable, createColumnHelper } from "@libretexts/davis-react-table";
import BookDashboard from "./BookSearch";

interface AddContentProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: ReferenceFormData) => boolean | Promise<boolean>;
  addExistingReferences: (references: ReferenceEntry[]) => Promise<boolean>;
  /** Book-level citation style used for the live preview. */
  referenceFormat?: ReferenceFormatType;
  projectID: string;
  onAddBookPageAsReference: (data: { bookID: string; pageID: string }) => Promise<boolean>;
}

const LIBRETEXTS_BOOKS_TAB = 2;
const searchColumnHelper = createColumnHelper<ReferenceEntry>();

const AddContent: React.FC<AddContentProps> = ({
  open,
  onClose,
  onAdd,
  addExistingReferences,
  referenceFormat,
  projectID,
  onAddBookPageAsReference,
}) => {
  const [form, setForm] = useState<ReferenceFormData>(emptyReferenceForm());
  const [importOpen, setImportOpen] = useState(false);
  const [fromBibtex, setFromBibtex] = useState(false);
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const [query, setQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<ReferenceEntry[]>([]);

  const [selectedReferences, setSelectedReferences] = useState<
    ReferenceEntry[]
  >([]);

  const { data: catalogBooks = [], isLoading: isLoadingCatalogBook } = useQuery(
    {
      queryKey: ["catalogBook"],
      queryFn: async () => {
        const res = await api.getCommonsCatalog({ limit: 10000 });
        return res.data.books ?? [];
      },
      enabled: open && selectedTab === LIBRETEXTS_BOOKS_TAB,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    },
  );

  useEffect(() => {
    if (!open) {
      setForm(emptyReferenceForm());
      setImportOpen(false);
      setFromBibtex(false);
      setQuery("");
      setSearchResults([]);
      setSelectedReferences([]);
    }
  }, [open]);

  const updateField = (key: ReferenceFieldKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleTypeChange = (entryType: EntryType) => {
    if (fromBibtex) return;
    setForm((prev) => ({ ...prev, entryType }));
  };

  const handleClear = () => {
    setForm(emptyReferenceForm());
    setFromBibtex(false);
    setSelectedReferences([]);
  };

  const {
    mutate: searchReferences,
    isPending: isSearching,
    reset: resetSearch,
  } = useMutation({
    mutationFn: (searchQuery: string) =>
      api.getSearchReferences(projectID, searchQuery),
    onSuccess: (data) => {
      setSearchResults(data.data?.references ?? []);
    },
    onError: () => {
      setSearchResults([]);
    },
  });

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length <= 3 || !projectID) {
      setSearchResults([]);
      resetSearch();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      searchReferences(trimmed);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query, projectID, searchReferences, resetSearch]);

  const canAdd =
    !!form.citationKey.trim() ||
    !!form.author?.trim() ||
    !!form.title?.trim() ||
    !!form.year?.trim();

  const tabMethods = [
    () => addExistingReferences(selectedReferences),
    () => onAdd(form),
  ];
  const tabDisabled = [selectedReferences.length === 0, !canAdd];

  const handleTabSubmit = async () => {
    const success = await tabMethods[selectedTab]();
    if (!success) return;

    if (selectedTab === 0) {
      setSelectedReferences([]);
      setQuery("");
      setSearchResults([]);
      return;
    }

    setForm(emptyReferenceForm());
    setFromBibtex(false);
  };

  const fields = BIBTEX_FIELDS_BY_TYPE[form.entryType];
  const preview = useMemo(
    () => formatCitationPreview(form, referenceFormat),
    [form, referenceFormat],
  );

  const searchColumns = useMemo(
    () => [
      searchColumnHelper.accessor("referenceID", {
        header: "",
        size: 140,
        cell: (info) => {
          const id = info.getValue();
          return (
            <Checkbox
              checked={selectedReferences.some(
                (reference) => reference.referenceID === id,
              )}
              name={id}
              onChange={(checked) => {
                setSelectedReferences((prev) =>
                  checked
                    ? [...prev, info.row.original]
                    : prev.filter((reference) => reference.referenceID !== id),
                );
              }}
            />
          );
        },
      }),
      searchColumnHelper.accessor("citationKey", {
        header: "Citation key",
        size: 140,
      }),
      searchColumnHelper.accessor("entryType", {
        header: "Type",
        size: 110,
      }),
      searchColumnHelper.accessor("author", {
        header: "Author",
        size: 160,
        cell: (info) => info.getValue() || "—",
      }),
      searchColumnHelper.accessor("title", {
        header: "Title",
        size: 240,
        cell: (info) => info.getValue() || "—",
      }),
      searchColumnHelper.accessor("year", {
        header: "Year",
        size: 70,
        cell: (info) => info.getValue() || "—",
      }),
    ],
    [selectedReferences],
  );

  return (
    <>
      <Modal open={open} onClose={onClose} size="lg">
        <Modal.Header>
          <Modal.Title>Add reference</Modal.Title>
          <Modal.Close aria-label="Close" />
        </Modal.Header>
        <Modal.Body>
          <Tabs selectedIndex={selectedTab} onChange={setSelectedTab}>
            <Tabs.List>

              <Tabs.Tab>Search and Import</Tabs.Tab>
              <Tabs.Tab>New Reference</Tabs.Tab>
              <Tabs.Tab>Libretexts Books</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel>
              <Stack direction="vertical" gap="md">
                <Input
                  name="query"
                  label="Search"
                  placeholder="Search for a reference"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query.trim().length > 0 && query.trim().length <= 3 && (
                  <Text size="sm" className="text-neutral-500">
                    Type at least 4 characters to search.
                  </Text>
                )}
                {isSearching && <Spinner size="sm" />}
                {!isSearching &&
                  query.trim().length > 3 &&
                  searchResults.length === 0 && (
                    <Text size="sm" className="text-neutral-500">
                      No references found.
                    </Text>
                  )}
                {searchResults.length > 0 && (
                  <Stack direction="vertical" gap="sm">
                    <Stack
                      direction="horizontal"
                      gap="sm"
                      className="flex-wrap items-center"
                    >
                      <Text size="sm" className="text-neutral-500">
                        {selectedReferences.length} selected
                      </Text>
                      {selectedReferences.map((reference) => (
                        <Tooltip
                          key={reference.referenceID}
                          content={formatCitationPreview({...reference}, referenceFormat)}
                        >
                          <Badge
                            key={reference.referenceID}
                            label={reference.citationKey}
                            variant="primary"
                            size="sm"
                            onRemove={() => {
                              setSelectedReferences((prev) =>
                                prev.filter(
                                  (r) =>
                                    r.referenceID !== reference.referenceID,
                                ),
                              );
                            }}
                          />
                        </Tooltip>
                      ))}
                    </Stack>
                    <DataTable<ReferenceEntry>
                      data={searchResults}
                      columns={searchColumns}
                      stickyHeader
                      striped
                      bordered
                      density="compact"
                      maxHeight="40vh"
                      classNames={{
                        table: "table-fixed w-full",
                        cell: "!whitespace-normal min-w-0 break-words",
                      }}
                    />
                  </Stack>
                )}
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel>
              <Stack direction="vertical" gap="md">
                <div>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-[12rem] flex-1">
                      <Select
                        name="entryType"
                        label="Entry type"
                        placeholder="Select entry type…"
                        options={EntryTypes.map((t) => ({
                          label: t.label,
                          value: t.value,
                        }))}
                        value={form.entryType}
                        disabled={fromBibtex}
                        onChange={(e) =>
                          handleTypeChange(e.target.value as EntryType)
                        }
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setImportOpen(true)}
                    >
                      Import from BibTeX
                    </Button>
                  </div>
                  {fromBibtex && (
                    <p className="mt-1 text-xs text-neutral-500">
                      Entry type is locked because this reference was imported
                      from BibTeX.
                    </p>
                  )}
                </div>

                <div className="max-h-[40vh] overflow-y-auto rounded border border-gray-200 p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {fields.map((key) => (
                      <div
                        key={key}
                        className={
                          key === "citationKey" ? "sm:col-span-2" : undefined
                        }
                      >
                        <Input
                          name={key}
                          label={getBibtexFieldLabel(key)}
                          value={form[key] ?? ""}
                          onChange={(e) => updateField(key, e.target.value)}
                          placeholder={
                            key === "citationKey"
                              ? "Auto-generated from author, year, title if left blank"
                              : undefined
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded border border-gray-200 bg-gray-50 p-3">
                  <Text size="sm" weight="semibold" className="mb-1 block">
                    Preview
                    {referenceFormat ? ` (${referenceFormat})` : ""}
                  </Text>
                  {preview ? (
                    <p className="text-sm leading-relaxed text-neutral-800">
                      {preview}
                    </p>
                  ) : (
                    <p className="text-sm italic text-neutral-500">
                      {referenceFormat
                        ? "Fill in author or title to see a citation preview."
                        : "Select a book references format to enable citation preview."}
                    </p>
                  )}
                </div>
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel>
              <BookDashboard
                onAddBookPageAsReference={onAddBookPageAsReference}
                books={catalogBooks}
                projectID={projectID}
                isLoading={isLoadingCatalogBook}
              />
            </Tabs.Panel>
          </Tabs>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline" onClick={handleClear}>
            Clear
          </Button>
          <Button
            variant="primary"
            onClick={handleTabSubmit}
            disabled={tabDisabled[selectedTab]}
          >
            Add
          </Button>
        </Modal.Footer>
      </Modal>

      <ImportBibtexDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(parsed) => {
          setForm(parsed);
          setFromBibtex(true);
        }}
      />
    </>
  );
};

export default AddContent;
