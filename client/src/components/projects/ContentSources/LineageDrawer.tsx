import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Drawer,
  Link,
  Spinner,
  Tabs,
  Text,
} from "@libretexts/davis-react";
import api from "../../../api";
import type {
  ContentSourcesLineageStep,
  ContentSourcesPage,
  ContentSourcesRef,
} from "../../../types/ContentSources";
import { EDGE_TYPE_LABELS, STATUS_BADGES } from "./labels";

const PageLink: React.FC<{ page: ContentSourcesRef }> = ({ page }) =>
  page.url ? (
    <Link href={page.url} target="_blank" rel="noopener noreferrer">
      {page.title}
      <span className="sr-only"> (opens in a new tab)</span>
    </Link>
  ) : (
    <span>{page.title}</span>
  );

const StepList: React.FC<{
  steps: ContentSourcesLineageStep[];
  direction: "up" | "down";
}> = ({ steps, direction }) => {
  if (steps.length === 0) {
    return (
      <Text className="block text-neutral-700">
        {direction === "up"
          ? "This page reuses nothing; its content is its own."
          : "No other page reuses this page."}
      </Text>
    );
  }
  return (
    <ol className="list-none space-y-3 p-0">
      {steps.map((step) => {
        const status = STATUS_BADGES[step.status];
        const far = direction === "up" ? step.source : step.target;
        const near = direction === "up" ? step.target : step.source;
        return (
          <li
            key={`${step.source.id}>${step.target.id}`}
            className="rounded border border-neutral-200 p-3"
          >
            <Text size="sm" className="block text-neutral-600">
              {step.hops === 1 ? "Direct" : `${step.hops} steps away`} ·{" "}
              {EDGE_TYPE_LABELS[step.type]}
            </Text>
            <div className="mt-1">
              <PageLink page={far} />
            </div>
            <Text size="sm" className="block text-neutral-600">
              {direction === "up" ? "reused by " : "reuses "}
              {near.title}
            </Text>
            {step.status !== "active" && (
              <Badge label={status.label} variant={status.variant} size="sm" className="mt-2" />
            )}
          </li>
        );
      })}
    </ol>
  );
};

interface LineageDrawerProps {
  projectID: string;
  page: ContentSourcesPage | null;
  onClose: () => void;
}

/** Where one page's content comes from, and who reuses it, step by step. */
const LineageDrawer: React.FC<LineageDrawerProps> = ({ projectID, page, onClose }) => {
  const [tab, setTab] = useState(0);
  const direction = tab === 0 ? "up" : "down";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["contentSourcesLineage", projectID, page?.pageID, direction],
    queryFn: () => api.getContentSourcesLineage(projectID, page!.pageID, direction),
    enabled: !!page,
    staleTime: 60_000,
  });

  return (
    <Drawer open={!!page} onClose={onClose} side="right" size="lg">
      <Drawer.Header>
        <Drawer.Title>{page?.title ?? "Page"}</Drawer.Title>
      </Drawer.Header>
      <Drawer.Body>
        {page?.reuseCycle && (
          <Alert
            variant="warning"
            className="mb-4"
            message="This page's reuse chain loops back on itself, so it has no single origin."
          />
        )}
        <Tabs selectedIndex={tab} onChange={setTab} variant="line" size="sm">
          <Tabs.List>
            <Tabs.Tab>Where it comes from</Tabs.Tab>
            <Tabs.Tab>Who reuses it</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panels>
            {[0, 1].map((index) => (
              <Tabs.Panel key={index} className="pt-4">
                {isLoading && <Spinner size="sm" text="Loading the reuse chain" />}
                {isError && <Alert variant="error" message="Couldn't load the reuse chain." />}
                {data?.data && (
                  <>
                    <StepList steps={data.data.steps} direction={direction} />
                    {data.data.truncated && (
                      <Text size="sm" className="mt-3 block text-neutral-600">
                        Showing the first 500 links only.
                      </Text>
                    )}
                  </>
                )}
              </Tabs.Panel>
            ))}
          </Tabs.Panels>
        </Tabs>
      </Drawer.Body>
    </Drawer>
  );
};

export default LineageDrawer;
