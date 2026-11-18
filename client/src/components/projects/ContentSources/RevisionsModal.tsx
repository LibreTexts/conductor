import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import classNames from "classnames";
import { format, parseISO } from "date-fns";
import { Alert, Heading, Modal, Spinner, Tabs, Text } from "@libretexts/davis-react";
import api from "../../../api";
import type { ContentSourcesRecentChange, ContentSourcesRevision } from "../../../types/ContentSources";

interface RevisionsModalProps {
  projectID: string;
  change: ContentSourcesRecentChange | null;
  onClose: () => void;
}

/** "This change" (the whole span) or one revision of the source. */
type Selection = "change" | number;

/** Sanitized on the server already; again here before it touches the DOM. */
const clean = (html: string | null | undefined) =>
  html ? DOMPurify.sanitize(html, { ADD_ATTR: ["target"] }) : null;

const DIFF_CLASSES = [
  "prose prose-sm max-w-none rounded border border-neutral-200 p-3",
  // Not colour alone: added is underlined, removed struck through.
  "[&_ins]:bg-green-100 [&_ins]:text-green-900 [&_ins]:underline",
  "[&_del]:bg-red-100 [&_del]:text-red-900 [&_del]:line-through",
].join(" ");

const Html: React.FC<{ html: string; className: string }> = ({ html, className }) => (
  // eslint-disable-next-line react/no-danger
  <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
);

const DiffLegend = () => (
  <Text size="sm" className="mb-2 block text-neutral-600">
    Added text is underlined, removed text is struck through.
  </Text>
);

const when = (rev: ContentSourcesRevision) =>
  [rev.editedAt ? format(parseISO(rev.editedAt), "MMM d, yyyy h:mm a") : null, rev.author ? `by ${rev.author}` : null]
    .filter(Boolean)
    .join(" · ");

/**
 * A changed source page's versions, read in Conductor instead of on the
 * library: the revisions this change is made of, each with its message, the whole change
 * under review (e.g. 8 → 10) as one diff, and for any one revision what it
 * changed and the page as it was then. Read live from the source's library
 * through Conductor; nothing is written.
 */
const RevisionsModal: React.FC<RevisionsModalProps> = ({ projectID, change, onClose }) => {
  const [selected, setSelected] = useState<Selection>("change");
  const [tab, setTab] = useState(0);
  useEffect(() => {
    setSelected("change");
    setTab(0);
  }, [change?.eventID]);

  const historyQuery = useQuery({
    queryKey: ["contentSourcesRevisions", projectID, change?.eventID],
    queryFn: () => api.getContentSourcesChangeRevisions(projectID, change!.eventID),
    enabled: !!change,
    staleTime: 5 * 60_000,
  });
  const revisionQuery = useQuery({
    queryKey: ["contentSourcesRevision", projectID, change?.eventID, selected],
    queryFn: () => api.getContentSourcesRevision(projectID, change!.eventID, selected as number),
    enabled: !!change && typeof selected === "number",
    staleTime: 5 * 60_000,
  });
  const history = historyQuery.data?.data;
  // Only the revisions this change is made of, newest first.
  const changeRevisions = history?.revisions.filter((r) => r.inChange) ?? [];
  const detail = typeof selected === "number" ? revisionQuery.data?.data : undefined;

  const range =
    change?.fromRev !== undefined && change?.toRev !== undefined
      ? `Revision ${change.fromRev} → ${change.toRev}`
      : change?.toRev !== undefined
        ? `Revision ${change.toRev}`
        : null;

  const choose = (next: Selection) => {
    setSelected(next);
    setTab(0);
  };

  const entry = (key: Selection, children: React.ReactNode) => {
    const current = selected === key;
    return (
      <li key={String(key)}>
        <button
          type="button"
          aria-current={current ? "true" : undefined}
          onClick={() => choose(key)}
          className={classNames(
            "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
            current ? "border-blue-600 bg-blue-50" : "border-neutral-200 bg-white hover:bg-neutral-50",
          )}
        >
          {children}
        </button>
      </li>
    );
  };

  return (
    <Modal open={!!change} onClose={onClose} size="xl">
      <Modal.Header>
        <Modal.Title>{change?.source.title ?? "Source revisions"}</Modal.Title>
        {range && <Modal.Description>Changed in {range.toLowerCase()} of the source page.</Modal.Description>}
        <Modal.Close aria-label="Close revisions" />
      </Modal.Header>
      <Modal.Body className="max-h-[75vh] overflow-y-auto">
        {change?.deleted && (
          <Alert variant="error" message="This page was deleted, so it has no revisions to show." />
        )}
        {historyQuery.isLoading && <Spinner size="sm" text="Loading revisions" />}
        {historyQuery.isError && <Alert variant="error" message="Couldn't load the revisions." />}

        {history && !history.deleted && (
          <div className="grid gap-4 md:grid-cols-[17rem_minmax(0,1fr)]">
            <nav aria-label="Versions of the source page">
              <Heading level={3} className="mb-2 text-base">
                Versions
              </Heading>
              <ol className="m-0 list-none space-y-2 p-0">
                {range &&
                  entry(
                    "change",
                    <>
                      <span className="block font-semibold text-neutral-900">This change</span>
                      <span className="block text-neutral-700">{range}</span>
                    </>,
                  )}
                {changeRevisions.map((rev) =>
                  entry(
                    rev.revision,
                    <>
                      <span className="block font-semibold text-neutral-900">Revision {rev.revision}</span>
                      <span className="mt-0.5 block text-neutral-800">{rev.summary || "No message"}</span>
                      {when(rev) && <span className="block text-xs text-neutral-600">{when(rev)}</span>}
                    </>,
                  ),
                )}
              </ol>
              {changeRevisions.length === 0 && (
                <Text className="mt-2 block text-neutral-700">The library didn't return this change's revisions.</Text>
              )}
            </nav>

            <section aria-label="Selected version" className="min-w-0">
              {/* Announces only which version is showing; the diff or page itself
                  isn't live, so a screen reader doesn't read it all on every pick. */}
              <span className="sr-only" aria-live="polite">
                {selected === "change"
                  ? range
                    ? `Showing this change, ${range.toLowerCase()}`
                    : ""
                  : revisionQuery.isLoading
                    ? `Loading revision ${selected}`
                    : `Showing revision ${selected}`}
              </span>
              {selected === "change" ? (
                <>
                  <Heading level={3} className="mb-1 text-base">
                    What changed in {range?.toLowerCase()}
                  </Heading>
                  {changeRevisions.length > 0 && (
                    <ul className="mb-3 list-disc pl-5 text-sm text-neutral-700">
                      {changeRevisions.map((r) => (
                        <li key={r.revision}>
                          Revision {r.revision}: {r.summary || "No message"}
                        </li>
                      ))}
                    </ul>
                  )}
                  {clean(history.diffHtml) ? (
                    <>
                      <DiffLegend />
                      <Html html={clean(history.diffHtml)!} className={DIFF_CLASSES} />
                    </>
                  ) : (
                    <Text className="block text-neutral-700">
                      {history.fromRev === undefined
                        ? "There's no earlier revision recorded to compare with. Pick a version to read it."
                        : "The library didn't return a comparison for these revisions."}
                    </Text>
                  )}
                </>
              ) : (
                <>
                  {revisionQuery.isLoading && <Spinner size="sm" text={`Loading revision ${selected}`} />}
                  {revisionQuery.isError && (
                    <Alert
                      variant="error"
                      message={`Couldn't load revision ${selected}. The library may not be responding; try again shortly.`}
                    />
                  )}
                  {detail && (
                    <>
                      <Heading level={3} className="mb-1 text-base">
                        Revision {detail.revision.revision}
                      </Heading>
                      <Text className="block text-neutral-800">{detail.revision.summary || "No message"}</Text>
                      {when(detail.revision) && (
                        <Text size="sm" className="mb-3 block text-neutral-600">
                          {when(detail.revision)}
                        </Text>
                      )}
                      <Tabs selectedIndex={tab} onChange={setTab} size="sm">
                        <Tabs.List>
                          <Tabs.Tab>What changed</Tabs.Tab>
                          <Tabs.Tab>This version</Tabs.Tab>
                        </Tabs.List>
                        <Tabs.Panels className="mt-3">
                          <Tabs.Panel>
                            {detail.previous === null ? (
                              <Text className="block text-neutral-700">
                                This is the page's first revision; there's nothing earlier to compare with.
                              </Text>
                            ) : clean(detail.diffHtml) ? (
                              <>
                                <Text size="sm" className="mb-1 block text-neutral-600">
                                  Compared with revision {detail.previous}.
                                </Text>
                                <DiffLegend />
                                <Html html={clean(detail.diffHtml)!} className={DIFF_CLASSES} />
                              </>
                            ) : (
                              <Text className="block text-neutral-700">
                                The library didn't return a comparison with revision {detail.previous}.
                              </Text>
                            )}
                          </Tabs.Panel>
                          <Tabs.Panel>
                            {clean(detail.contentHtml) ? (
                              <>
                                <Text size="sm" className="mb-2 block text-neutral-600">
                                  The page as it was at revision {detail.revision.revision}. Scripts, styles
                                  and embedded media aren't shown.
                                </Text>
                                <Html
                                  html={clean(detail.contentHtml)!}
                                  className="prose prose-sm max-w-none rounded border border-neutral-200 p-3 [&_img]:h-auto [&_img]:max-w-full"
                                />
                              </>
                            ) : (
                              <Text className="block text-neutral-700">
                                The library didn't return this version's content.
                              </Text>
                            )}
                          </Tabs.Panel>
                        </Tabs.Panels>
                      </Tabs>
                    </>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default RevisionsModal;
