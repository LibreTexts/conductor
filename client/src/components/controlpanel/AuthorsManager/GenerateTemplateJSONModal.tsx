import { useEffect, useState } from "react";
import { Modal } from "semantic-ui-react";
import { Author } from "../../../types";
import api from "../../../api";
import { useInfiniteQuery } from "@tanstack/react-query";
import Button from "../../NextGenComponents/Button";

type GenerateTemplateJSONModalProps = {
    onClose: () => void;
}

/**
 * Only these keys from the Author data should be included in the template.
 * If the key isn't present in the Author's data, simply omit it from the output JSON.
 * The 'nameKey' serves as the key for each author object in the JSON, and it is required.
 * The rest of the keys are optional and can be included if the data is available for that author.
 */
const KEYS_TO_INCLUDE: (keyof Author)[] = [
    "nameKey",
    "name",
    "nameTitle",
    "nameURL",
    "note",
    "noteURL",
    "companyName",
    "companyURL",
    "pictureCircle",
    "pictureURL",
    "programName",
    "programURL",
    "attributionPrefix",
]

const FETCH_LIMIT = 500;

function toLowercaseKeys(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [
            key.toLowerCase(),
            value !== null && typeof value === "object" && !Array.isArray(value)
                ? toLowercaseKeys(value as Record<string, unknown>)
                : value,
        ])
    );
}

/**
 * Remove invalid escape sequences from string values before they enter the JSON output.
 * Collapses one or more backslashes immediately before an apostrophe into just the apostrophe,
 * mirroring the fix applied during the author import migration.
 * All other escaping is handled correctly by JSON.stringify.
 */
function sanitizeValue(value: unknown): unknown {
    if (typeof value !== "string") return value;
    return value.replace(/\\+'(?!')/g, "'");
}

const GenerateTemplateJSONModal = ({ onClose }: GenerateTemplateJSONModalProps) => {
    const [shouldFetch, setShouldFetch] = useState(false);
    const [copied, setCopied] = useState(false);

    const { data, isFetching, fetchNextPage, hasNextPage } = useInfiniteQuery({
        queryKey: ["authors-template", FETCH_LIMIT],
        queryFn: async ({ pageParam = 1 }) => {
            const response = await api.getAuthors({ limit: FETCH_LIMIT, page: pageParam as number });
            if (response.data.err) throw new Error(response.data.errMsg || "Failed to fetch authors.");
            return response.data;
        },
        getNextPageParam: (lastPage) => {
            if (!lastPage?.meta?.has_more || !lastPage?.meta?.next_page) return null;
            const parsed = parseInt(lastPage.meta.next_page as string, 10);
            return isNaN(parsed) ? undefined : parsed;
        },
        enabled: shouldFetch,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
    });

    // Automatically fetch all pages once generation starts
    useEffect(() => {
        if (shouldFetch && hasNextPage && !isFetching) {
            fetchNextPage();
        }
    }, [shouldFetch, hasNextPage, isFetching, fetchNextPage]);

    const allAuthors = data?.pages.flatMap((page) => page.items) ?? [];
    const isLoading = shouldFetch && isFetching;
    const isComplete = shouldFetch && !isFetching && data !== undefined;

    const jsonOutput = isComplete ? (() => {
        const seen = new Set<string>();
        const result: Record<string, unknown> = {};

        for (const author of allAuthors) {
            if (!author.nameKey || seen.has(author.nameKey)) continue;
            seen.add(author.nameKey);

            const filtered = Object.fromEntries(
                KEYS_TO_INCLUDE
                    .filter((key) => {
                        if (key === "nameKey") return false; // nameKey is used as the root key and should not be nested within the author object
                        if (!(key in author) || author[key] === undefined || author[key] === "") return false; // exlude keys that are not present or have empty values
                        if (key === "pictureCircle") return author[key] === "no"; // only include pictureCircle if it's "no" to indicate non-circular pictures, since "yes" is the default assumption in the template
                        return true;
                    })
                    .map((key) => [key, sanitizeValue(author[key])])
            );

            result[author.nameKey.toLowerCase()] = toLowercaseKeys(filtered as Record<string, unknown>);
        }

        return JSON.stringify(result, null, 2);
    })() : null;

    async function handleCopy() {
        if (!jsonOutput) return;
        await navigator.clipboard.writeText(jsonOutput);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <Modal size="large" open onClose={onClose}>
            <Modal.Header>Copy Template JSON</Modal.Header>
            <Modal.Content>
                <p className="mb-4">
                    Click <strong>Generate</strong> to load all author data and preview a template JSON object. Each author's <code>nameKey</code> is used as the root key.
                    Use the generated JSON to replace the current JSON in <strong>Page Content Header</strong> and <strong>Page Content Footer</strong> templates and propagate the changes. Only authors with a <code>nameKey</code> will be included in the output.
                </p>
                <div className="flex gap-x-2 mb-4">
                    <Button
                        icon="IconRefresh"
                        onClick={() => setShouldFetch(true)}
                        loading={isLoading}
                        disabled={isLoading || isComplete}
                    >
                        Generate
                    </Button>
                    {jsonOutput && (
                        <Button
                            variant="secondary"
                            icon={copied ? "IconCheck" : "IconCopy"}
                            onClick={handleCopy}
                        >
                            {copied ? "Copied!" : "Copy to Clipboard"}
                        </Button>
                    )}
                </div>
                {jsonOutput && (
                    <pre className="bg-gray-900 text-green-400 text-xs rounded-md p-4 overflow-auto max-h-[500px] font-mono whitespace-pre">
                        {jsonOutput}
                    </pre>
                )}
            </Modal.Content>
            <Modal.Actions className="flex justify-end">
                <Button variant="secondary" onClick={onClose}>
                    Close
                </Button>
            </Modal.Actions>
        </Modal>
    );
};

export default GenerateTemplateJSONModal;
