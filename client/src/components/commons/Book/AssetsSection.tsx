import { Breadcrumb, Button, Card, Stack, Heading, Text, IconButton, Input } from "@libretexts/davis-react";
import { IconDownload, IconFileDescription, IconFolder, IconFolderOpen, IconSchool, IconSchoolFilled, IconSearch, IconUsersGroup } from "@tabler/icons-react";
import { useCallback, useMemo, useState } from "react";
import { List, Popup } from "semantic-ui-react";
import { truncateString } from "../../util/HelperFunctions";
import { useTypedSelector } from "../../../state/hooks";
import { useQuery } from "@tanstack/react-query";
import { BookWithSourceData, ProjectFile } from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";

interface AssetsSectionProps {
    book: BookWithSourceData;
    showFiles: boolean;
    handleChangeFilesVis: () => void;
}

type DirPathNode = { fileID: string; name: string };
type BookFilesResult = { files: ProjectFile[]; path: DirPathNode[] };

// Stable reference for the root breadcrumb so it doesn't reallocate each render.
const ROOT_DIR_PATH: DirPathNode[] = [{ fileID: "", name: "" }];


const AssetsSection: React.FC<AssetsSectionProps> = ({
    book,
    showFiles,
    handleChangeFilesVis,
}) => {
    // Global State & Error Handling
    const { handleGlobalError } = useGlobalError();
    const user = useTypedSelector((state) => state.user);

    // Project Files
    const [currDirectory, setCurrDirectory] = useState<string>("");

    // File Search — a single query string; the filtered list is derived, never stored.
    const [fileSearchQuery, setFileSearchQuery] = useState<string>("");

    const { data, isFetching } = useQuery<BookFilesResult>(
        {
            queryKey: ["book-files", book.projectID, currDirectory],
            queryFn: () => getProjectFiles(book.projectID, currDirectory),
            staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: false,
            enabled: !!book.projectID, // only fetch if projectID is available
        }
    );

    // Files and breadcrumb path both come straight from the query result — no
    // separate state, no setter fired from inside the fetch.
    const files = data?.files;
    const currDirPath = data?.path?.length ? data.path : ROOT_DIR_PATH;

    /**
     * The list actually rendered: `files` narrowed by the current search query.
     * Derived during render so it can never drift out of sync with `files`.
     */
    const filteredFiles = useMemo(() => {
        if (!files) return [];
        const query = fileSearchQuery.trim().toLowerCase();
        if (!query) return files;
        return files.filter((file) =>
            `${file.name ?? ""} ${file.description ?? ""}`
                .toLowerCase()
                .includes(query)
        );
    }, [files, fileSearchQuery]);

    /**
     * Load the Files list from the server, prepare it for the UI, then save it to state.
     */
    async function getProjectFiles(projectID?: string, currDirectory?: string): Promise<BookFilesResult> {
        try {
            if (!projectID) return { files: [], path: ROOT_DIR_PATH };

            const res = await api.getProjectFiles(
                projectID,
                currDirectory || "", // default to root directory if not specified
                !(user.isAuthenticated ?? false) // default to public only (true) if can't determine auth
            );
            if (res.data.err) {
                throw new Error(res.data.errMsg);
            }

            if (!res.data.files || !Array.isArray(res.data.files)) {
                return { files: [], path: ROOT_DIR_PATH };
            }

            return {
                files: res.data.files,
                path: Array.isArray(res.data.path) ? res.data.path : ROOT_DIR_PATH,
            };
        } catch (e) {
            handleGlobalError(e);
            return { files: [], path: ROOT_DIR_PATH };
        }
    }

    /**
     * Navigate to a directory. Clears the active search so a stale filter can't
     * hide files in the folder we're moving into.
     */
    const changeDirectory = useCallback((dirID: string) => {
        setFileSearchQuery("");
        setCurrDirectory(dirID);
    }, []);

    async function handleDownloadFile(fileID: string) {
        try {
            const downloadRes = await api.getCommonsDownloadFileURL(book.bookID, fileID);
            if (downloadRes.data.err) {
                throw new Error(downloadRes.data.errMsg || "Encountered an error while downloading the file.");
            }
            if (typeof downloadRes.data.url === "string") {
                window.open(downloadRes.data.url, "_blank", "noreferrer");
            }
        } catch (e) {
            handleGlobalError(e);
        }
    }


    function DirectoryBreadcrumbs() {
        return (
            <Breadcrumb aria-label="Asset directory">
                {currDirPath.map((item, idx) => {
                    const isCurrent = idx === currDirPath.length - 1;
                    const isRoot = item.name === "" && item.fileID === "";
                    const name = isRoot ? "Assets" : item.name;
                    return (
                        <Breadcrumb.Item key={item.fileID || "root"} isCurrent={isCurrent}>
                            {isCurrent ? (
                                name
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => changeDirectory(item.fileID)}
                                    className="appearance-none bg-transparent border-none p-0 m-0 cursor-pointer text-inherit font-inherit"
                                >
                                    {name}
                                </button>
                            )}
                        </Breadcrumb.Item>
                    );
                })}
            </Breadcrumb>
        );
    }

    /**
     * Don't render the Assets section at all if there are no files at the root.
     * `files` is the root listing whenever currDirectory is "", so emptiness is
     * read straight from the query (cache included) — no latched ref that could
     * go stale across remounts. We still show once currDirectory is not the root
     * so users can navigate back.
     */
    if (currDirectory === "" && (files?.length ?? 0) === 0) {
        return null;
    }

    return (
        <Card padding="sm">
            <Stack direction="horizontal" gap="sm" align="center" justify="between">
                <Heading level={2}>Assets</Heading>
                <Button
                    variant="tertiary"
                    onClick={() => {
                        setFileSearchQuery("");
                        handleChangeFilesVis();
                    }}
                >
                    {showFiles ? "Hide" : "Show"}
                </Button>
            </Stack>
            {showFiles && (
                <>
                    <div className="py-2 border-b border-neutral-200">
                        <div className="flex-row-div">
                            <div className="left-flex">
                                {DirectoryBreadcrumbs()}
                            </div>
                            <div className="right-flex">
                                <Input
                                    name="file-search"
                                    label=""
                                    type="text"
                                    leftIcon={<IconSearch size={16} />}
                                    placeholder="Search assets..."
                                    value={fileSearchQuery}
                                    onChange={(e) => setFileSearchQuery(e.target.value)}
                                    disabled={isFetching || !files || files.length === 0}
                                />
                            </div>
                        </div>
                    </div>
                    {isFetching ? (
                        <div>
                            <p className="text-center muted-text">
                                <em>Loading assets...</em>
                            </p>
                        </div>
                    ) : filteredFiles.length > 0 ? (
                        <List divided verticalAlign="middle">
                            {filteredFiles.map((file) => {
                                return (
                                    <List.Item key={file.fileID}>
                                        <div className="flex-col-div">
                                            <div className="flex-row-div">
                                                <div className="left-flex">
                                                    <div className="project-file-title-column">
                                                        <div className={file.description ? "mb-1" : ""}>
                                                            {file.storageType === "folder" ? (
                                                                <IconFolder size={16} className="inline mr-1 shrink-0 mb-1" aria-hidden="true" />
                                                            ) : file.access === 'instructors' ? (
                                                                <IconSchoolFilled size={16} className="inline mr-1 shrink-0 mb-1 text-primary" aria-hidden="true" />
                                                            ) : file.access === 'public' ? (
                                                                <IconUsersGroup size={16} className="inline mr-1 shrink-0 mb-1" aria-hidden="true" />
                                                            ) : (
                                                                <IconFileDescription size={16} className="inline mr-1 shrink-0 mb-1" aria-hidden="true" />
                                                            )}
                                                            {file.storageType === "folder" ? (
                                                                <Text
                                                                    as="button"
                                                                    type="button"
                                                                    className="text-link appearance-none bg-transparent border-none p-0 m-0 cursor-pointer text-left text-base!"
                                                                    aria-label={`Open Folder ${file.name}`}
                                                                    onClick={() => changeDirectory(file.fileID)}
                                                                >
                                                                    {file.name}
                                                                </Text>
                                                            ) : (
                                                                <Text
                                                                    as="button"
                                                                    type="button"
                                                                    className="appearance-none bg-transparent border-none p-0 m-0 cursor-pointer text-left text-base!"
                                                                    aria-label={`Download Asset ${file.name} (opens in new tab)`}
                                                                    onClick={() => handleDownloadFile(file.fileID)}
                                                                >
                                                                    {file.name}
                                                                </Text>
                                                            )}
                                                            {
                                                                file.access === 'instructors' && user?.isAuthenticated && user?.verifiedInstructor && (
                                                                    <Popup
                                                                        content="This asset is restricted to verified instructors. You're good to go!"
                                                                        trigger={
                                                                            <IconSchool size={16} color="blue" className="!ml-2 !mt-0.5" />
                                                                        }
                                                                        position="top center"
                                                                    />
                                                                )
                                                            }
                                                        </div>
                                                        <div>
                                                            {file.description && (
                                                                <Text
                                                                    className="text-sm pl-5 line-clamp-1"
                                                                >
                                                                    {truncateString(
                                                                        file.description,
                                                                        100
                                                                    )}
                                                                </Text>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="right-flex">
                                                    {
                                                        file.storageType === "folder" ? (
                                                            <IconButton
                                                                icon={<IconFolderOpen size={16} />}
                                                                size="sm"
                                                                variant="primary"
                                                                title={`Open Folder ${file.name}`}
                                                                aria-label={`Open Folder ${file.name}`}
                                                                onClick={() =>
                                                                    changeDirectory(file.fileID)
                                                                }
                                                            />
                                                        ) : (
                                                            <IconButton
                                                                icon={<IconDownload size={16} />}
                                                                size="sm"
                                                                variant="primary"
                                                                title={`Download Asset ${file.name} (opens in new tab)`}
                                                                aria-label={`Download Asset ${file.name} (opens in new tab)`}
                                                                onClick={() =>
                                                                    handleDownloadFile(file.fileID)
                                                                }
                                                            />
                                                        )
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    </List.Item>
                                );
                            })}
                        </List>
                    ) : (
                        <div>
                            <p className="text-center muted-text">
                                <em>
                                    {fileSearchQuery
                                        ? "No assets match your search."
                                        : "No assets yet."}
                                </em>
                            </p>
                        </div>
                    )}
                </>
            )}
        </Card>
    )
};

export default AssetsSection;
