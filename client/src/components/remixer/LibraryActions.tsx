import { IconButton, Menu, Select, Stack, Tooltip } from "@libretexts/davis-react";
import { IconCheck, IconSearch } from "@tabler/icons-react";
import { RemixerData, libraryTitles } from "./model";
import { isLibrary } from "./services";

interface LibraryActionsProps {
    isNarrowScreen: boolean;
    remixerData: RemixerData;
    setRemixerData: React.Dispatch<React.SetStateAction<RemixerData>>;
    onOpenCatalogModal: () => void;
    /** True until the catalog book list has loaded; the catalog can't be searched before then. */
    catalogLoading?: boolean;
}

const LibraryActions: React.FC<LibraryActionsProps> = ({
    isNarrowScreen,
    remixerData,
    setRemixerData,
    onOpenCatalogModal,
    catalogLoading = false,
}) => {
    if (isNarrowScreen) {
        return (
            <Menu>
                <Menu.Button aria-label="Library Actions" >
                    Library Actions
                </Menu.Button>
                <Menu.Items>
                    {(remixerData.libraries ?? []).map((library) => {
                        const isSelected =
                            remixerData.selectedLibrary === library;
                        return (
                            <Menu.Item
                                key={library}
                                icon={isSelected ? <IconCheck size={16} /> : undefined}
                                onClick={() =>
                                    setRemixerData((prev) => ({
                                        ...prev,
                                        selectedLibrary: isLibrary(library)
                                            ? library
                                            : undefined,
                                    }))
                                }
                            >
                                {isLibrary(library)
                                    ? libraryTitles[library]
                                    : library}
                            </Menu.Item>
                        );
                    })}
                    <Menu.Divider />
                    <Menu.Item
                        icon={<IconSearch size={16} />}
                        onClick={onOpenCatalogModal}
                        disabled={catalogLoading}
                    >
                        {catalogLoading ? "Loading Catalog…" : "Search Catalog"}
                    </Menu.Item>
                </Menu.Items>
            </Menu>
        )
    }

    return (
        <Stack direction="horizontal" gap="sm" className="w-1/2" align="center" justify="end">
            {remixerData.libraries && (
                <Select
                    id="remixer-library"
                    className="w-full min-w-0 [&>div]:!mt-0"
                    labelClassName="sr-only"
                    selectClassName="!h-10 !box-border !py-0 leading-none"
                    name="remixer-library"
                    label="Library"
                    placeholder="Library..."
                    size="sm"
                    value={remixerData?.selectedLibrary ?? ""}
                    onChange={(e) => {
                        const raw = e.target.value;
                        const nextLibrary =
                            raw && isLibrary(raw) ? raw : undefined;
                        setRemixerData((prev) => ({
                            ...prev,
                            selectedLibrary: nextLibrary,
                        }));
                    }}
                    options={remixerData.libraries?.map((library) => ({
                        value: library,
                        label: isLibrary(library)
                            ? libraryTitles[library]
                            : library,
                    }))}
                />
            )}

            <Tooltip content={catalogLoading ? "Loading catalog…" : "Search Catalog"} placement="bottom">
                <IconButton
                    aria-label={catalogLoading ? "Loading catalog" : "Search Catalog Book"}
                    icon={<IconSearch size={16} />}
                    onClick={onOpenCatalogModal}
                    loading={catalogLoading}
                    disabled={catalogLoading}
                    // Davis "outline" border is below 3:1 (pending Davis fix).
                    variant="secondary"
                    size="md"
                    className="shrink-0"
                />
            </Tooltip>
        </Stack>
    )
}

export default LibraryActions;