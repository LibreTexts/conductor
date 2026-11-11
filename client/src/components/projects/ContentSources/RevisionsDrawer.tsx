import React from "react";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { format, parseISO } from "date-fns";
import { Alert, Drawer, Heading, Link, Spinner, Text } from "@libretexts/davis-react";
import api from "../../../api";
import type { ContentSourcesRecentChange } from "../../../types/ContentSources";

interface RevisionsDrawerProps {
  projectID: string;
  change: ContentSourcesRecentChange | null;
  onClose: () => void;
}

/**
 * The library revisions one source change spans (e.g. 8 → 10), each with its
 * author and edit summary, and what changed between the two ends. Read live
 * from the source's library through Conductor; nothing is written.
 */
const RevisionsDrawer: React.FC<RevisionsDrawerProps> = ({ projectID, change, onClose }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["contentSourcesRevisions", projectID, change?.eventID],
    queryFn: () => api.getContentSourcesChangeRevisions(projectID, change!.eventID),
    enabled: !!change,
    staleTime: 5 * 60_000,
  });
  const result = data?.data;
  // Sanitized on the server already; again here before it touches the DOM.
  const diffHtml = result?.diffHtml
    ? DOMPurify.sanitize(result.diffHtml, { ADD_ATTR: ["target"] })
    : null;

  const range =
    change?.fromRev !== undefined && change?.toRev !== undefined
      ? `Revision ${change.fromRev} → ${change.toRev}`
      : change?.toRev !== undefined
        ? `Revision ${change.toRev}`
        : null;

  return (
    <Drawer open={!!change} onClose={onClose} side="right" size="lg">
      <Drawer.Header>
        <Drawer.Title>{change?.source.title ?? "Revisions"}</Drawer.Title>
      </Drawer.Header>
      <Drawer.Body>
        {range && <Text className="mb-4 block text-neutral-700">{range}</Text>}
        {change?.deleted && (
          <Alert variant="error" message="This page was deleted, so it has no revisions to show." />
        )}
        {isLoading && <Spinner size="sm" text="Loading revisions" />}
        {isError && <Alert variant="error" message="Couldn't load the revisions." />}

        {result && !result.deleted && (
          <>
            <section aria-labelledby="cs-revisions-heading">
              <Heading level={4} id="cs-revisions-heading" className="mb-2 text-base">
                Revisions
              </Heading>
              {result.revisions.length === 0 ? (
                <Text className="block text-neutral-700">
                  The library didn't return these revisions.
                </Text>
              ) : (
                <ol className="m-0 list-none space-y-3 p-0">
                  {result.revisions.map((rev) => (
                    <li key={rev.revision} className="rounded border border-neutral-200 p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <strong>Revision {rev.revision}</strong>
                        {rev.editedAt && (
                          <Text size="sm" className="text-neutral-600">
                            {format(parseISO(rev.editedAt), "MMM d, yyyy h:mm a")}
                          </Text>
                        )}
                      </div>
                      <Text size="sm" className="mt-1 block text-neutral-700">
                        {rev.summary || "No summary"}
                        {rev.author ? ` · by ${rev.author}` : ""}
                      </Text>
                      {rev.url && (
                        <Link href={rev.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm">
                          View revision {rev.revision}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section aria-labelledby="cs-diff-heading" className="mt-6">
              <Heading level={4} id="cs-diff-heading" className="mb-2 text-base">
                What changed
              </Heading>
              {diffHtml ? (
                <>
                  <Text size="sm" className="mb-2 block text-neutral-600">
                    Added text is underlined, removed text is struck through.
                  </Text>
                  <div
                    className={[
                      "prose prose-sm max-w-none rounded border border-neutral-200 p-3",
                      // Not colour alone: added is underlined, removed struck through.
                      "[&_ins]:bg-green-100 [&_ins]:text-green-900 [&_ins]:underline",
                      "[&_del]:bg-red-100 [&_del]:text-red-900 [&_del]:line-through",
                    ].join(" ")}
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: diffHtml }}
                  />
                </>
              ) : (
                <Text className="block text-neutral-700">
                  {result.fromRev === undefined
                    ? "There's no earlier revision recorded to compare with."
                    : "The library didn't return a comparison for these revisions."}
                </Text>
              )}
            </section>
          </>
        )}
      </Drawer.Body>
    </Drawer>
  );
};

export default RevisionsDrawer;
