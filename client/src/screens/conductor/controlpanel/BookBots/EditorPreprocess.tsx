import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Badge,
  Breadcrumb,
  Button,
  Divider,
  FormSection,
  Heading,
  Input,
  Modal,
  Progress,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef } from "@libretexts/davis-react-table";
import {
  IconExternalLink,
  IconEye,
  IconRefresh,
  IconSend,
} from "@tabler/icons-react";
import { format as formatDate, parseISO } from "date-fns";
import api from "../../../../api";
import useDocumentTitle from "../../../../hooks/useDocumentTitle";
import { useNotifications } from "../../../../context/NotificationContext";
import { useTypedSelector } from "../../../../state/hooks";
import {
  BookBotRun,
  BookBotRunState,
} from "../../../../types/BookBot";

const LIBRETEXTS_URL_RE = /^https:\/\/[a-z0-9-]+\.libretexts\.org\//i;

const TERMINAL_STATES: BookBotRunState[] = ["done", "error"];

const STATE_VARIANT: Record<
  BookBotRunState,
  "default" | "primary" | "success" | "warning" | "danger"
> = {
  queued: "primary",
  starting: "primary",
  getSubpages: "warning",
  processing: "warning",
  done: "success",
  error: "danger",
};

function prettyState(state: BookBotRunState): string {
  switch (state) {
    case "queued":
      return "Queued. Cold start may take a minute or two";
    case "starting":
      return "Starting";
    case "getSubpages":
      return "Discovering Pages";
    case "processing":
      return "Processing";
    case "done":
      return "Done";
    case "error":
      return "Error";
  }
}

function formatTs(ts?: string): string {
  if (!ts) return "—";
  try {
    return formatDate(parseISO(ts), "MM/dd/yyyy h:mm:ss aaa");
  } catch {
    return ts;
  }
}

const EditorPreprocess = () => {
  useDocumentTitle("LibreTexts Conductor | Editor Preprocess Bot");
  const { addNotification } = useNotifications();
  const user = useTypedSelector((state) => state.user);

  useEffect(() => {
    if (!user || !user.uuid) return;
    if (!user.isSuperAdmin) {
      window.location.href = "/home";
    }
  }, [user]);

  // Active job for live feed
  const [activeJobID, setActiveJobID] = useState<string | null>(null);
  const logScrollRef = useRef<HTMLDivElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const modalMessagesScrollRef = useRef<HTMLDivElement | null>(null);

  // History table state
  const [activePage, setActivePage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Modal for viewing a past run
  const [viewingJobID, setViewingJobID] = useState<string | null>(null);

  // Submit form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ url: string }>();

  const submitMutation = useMutation({
    mutationFn: async (data: { url: string }) =>
      api.submitEditorPreprocessJob({ url: data.url }),
    onSuccess: (data) => {
      addNotification({
        type: "success",
        message: `Job submitted (${data.jobID})`,
      });
      setActiveJobID(data.jobID);
      reset();
      refetchRuns();
    },
    onError: (err: any) => {
      addNotification({
        type: "error",
        message:
          err?.response?.data?.errMsg || "Failed to submit job.",
      });
    },
  });

  // Live feed polling
  const liveFeed = useQuery({
    queryKey: ["bookBotRun", activeJobID],
    queryFn: async () => {
      if (!activeJobID) return null;
      const resp = await api.getBookBotRun(activeJobID);
      return resp.run;
    },
    enabled: !!activeJobID,
    refetchInterval: (data) => {
      const run = data as BookBotRun | null | undefined;
      if (!run) return 2000;
      return TERMINAL_STATES.includes(run.state) ? false : 2000;
    },
  });

  // Auto-scroll log feed to bottom as new entries arrive
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [liveFeed.data?.logs?.length]);

  // Auto-scroll verbose-messages feed to bottom as new entries arrive
  useEffect(() => {
    if (messagesScrollRef.current) {
      messagesScrollRef.current.scrollTop =
        messagesScrollRef.current.scrollHeight;
    }
  }, [liveFeed.data?.messages?.length]);

  useEffect(() => {
    if (modalMessagesScrollRef.current) {
      modalMessagesScrollRef.current.scrollTop =
        modalMessagesScrollRef.current.scrollHeight;
    }
  }, [viewingJobID]);

  // Refetch history when active job reaches a terminal state
  useEffect(() => {
    if (liveFeed.data && TERMINAL_STATES.includes(liveFeed.data.state)) {
      refetchRuns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveFeed.data?.state]);

  // History table data
  const {
    data: runs,
    isLoading: runsLoading,
    refetch: refetchRuns,
  } = useQuery<BookBotRun[]>({
    queryKey: ["bookBotRuns", activePage, itemsPerPage],
    queryFn: async () => {
      const resp = await api.listBookBotRuns({
        botType: "editor-preprocess",
        page: activePage,
        limit: itemsPerPage,
      });
      setTotalItems(resp?.meta?.total ?? 0);
      return resp.runs;
    },
  });

  // Modal data
  const modalRun = useQuery<BookBotRun | null>({
    queryKey: ["bookBotRun", viewingJobID],
    queryFn: async () => {
      if (!viewingJobID) return null;
      const resp = await api.getBookBotRun(viewingJobID);
      return resp.run;
    },
    enabled: !!viewingJobID,
  });

  const columns = useMemo<ColumnDef<BookBotRun>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Started",
        size: 180,
        cell: ({ getValue }) => formatTs(getValue<string>()),
      },
      {
        accessorKey: "triggeredBy",
        header: "Triggered By",
        size: 120,
        cell: ({ getValue }) => {
          const uuid = getValue<string>() || "";
          return uuid.length > 8 ? `${uuid.slice(0, 8)}…` : uuid;
        },
      },
      {
        accessorKey: "rootURL",
        header: "Root URL",
        cell: ({ getValue }) => {
          const url = getValue<string>();
          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-blue-700 inline-flex items-center gap-1"
            >
              {url}
              <IconExternalLink size={14} />
            </a>
          );
        },
      },
      {
        accessorKey: "state",
        header: "State",
        size: 130,
        cell: ({ getValue }) => {
          const state = getValue<BookBotRunState>();
          return (
            <Badge
              variant={STATE_VARIANT[state]}
              label={prettyState(state)}
            />
          );
        },
      },
      {
        header: "Actions",
        size: 100,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="primary"
            icon={<IconEye />}
            onClick={() => setViewingJobID(row.original.jobID)}
          >
            View
          </Button>
        ),
      },
    ],
    [],
  );

  const paginationState = {
    pageIndex: activePage - 1,
    pageSize: itemsPerPage,
  };

  const live = liveFeed.data;
  const liveRunning =
    !!live && !TERMINAL_STATES.includes(live.state);

  if (!user.isSuperAdmin) return null;

  return (
    <div className="!pt-16 !bg-white !h-full !px-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>Editor Preprocess Bot</Heading>
        <Breadcrumb>
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item href="/controlpanel/book-bots">
            Book Bots
          </Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Editor Preprocess</Breadcrumb.Item>
        </Breadcrumb>

        <form
          onSubmit={handleSubmit((data) => submitMutation.mutateAsync(data))}
        >
          <FormSection title="Submit Job">
            <Input
              label="Book Root URL"
              placeholder="https://bio.libretexts.org/Courses/Foo"
              required
              error={!!errors.url}
              errorMessage={errors.url?.message}
              {...register("url", {
                required: "Root URL is required",
                pattern: {
                  value: LIBRETEXTS_URL_RE,
                  message: "URL must be an HTTPS *.libretexts.org URL",
                },
              })}
            />
            <Button
              type="submit"
              variant="primary"
              loading={submitMutation.isPending}
              icon={<IconSend />}
            >
              Submit
            </Button>
          </FormSection>
        </form>

        {activeJobID && (
          <>
            <Divider />
            <div>
              <div className="flex items-center justify-between mb-2">
                <Heading level={3} className="mb-0!">
                  Live Feed
                </Heading>
                <div className="flex items-center gap-2">
                  {live && (
                    <Badge
                      variant={STATE_VARIANT[live.state]}
                      label={prettyState(live.state)}
                    />
                  )}
                  {!liveRunning && (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => setActiveJobID(null)}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              <Text className="text-sm text-gray-600 mb-2">
                Job ID: <code>{activeJobID}</code>. Leaving this page will end the
                live feed; you can still view the result in the history table
                below.
              </Text>
              {typeof live?.percentage === "number" && (
                <div className="mb-3">
                  <Progress
                    value={live.percentage}
                    showValue
                    variant={live.state === "error" ? "danger" : "default"}
                  />
                </div>
              )}
              <Text className="text-xs font-semibold text-gray-600 mb-1">
                State Log
              </Text>
              <div
                ref={logScrollRef}
                aria-live="polite"
                aria-label="Live job state log"
                className="bg-gray-900 text-gray-100 font-mono text-xs rounded-md p-3 h-40 overflow-auto whitespace-pre-wrap"
              >
                {live?.logs?.length
                  ? live.logs.map((entry, i) => (
                      <div key={i}>
                        <span className="text-gray-400">
                          [{formatTs(entry.ts)}]
                        </span>{" "}
                        <span className="text-yellow-300">
                          {prettyState(entry.state)}
                        </span>
                        {typeof entry.percentage === "number"
                          ? ` (${entry.percentage}%)`
                          : ""}
                        {entry.message ? `: ${entry.message}` : ""}
                      </div>
                    ))
                  : "Waiting for runner..."}
              </div>
              <Text className="text-xs font-semibold text-gray-600 mb-1 mt-3">
                Verbose Output ({live?.messages?.length ?? 0})
              </Text>
              <div
                ref={messagesScrollRef}
                aria-live="polite"
                aria-label="Live job verbose output"
                className="bg-gray-900 text-green-200 font-mono text-xs rounded-md p-3 h-80 overflow-auto whitespace-pre-wrap"
              >
                {live?.messages?.length
                  ? live.messages.map((m, i) => <div key={i}>{m}</div>)
                  : "(no verbose output yet)"}
              </div>
              {live?.state === "error" && live.errorMessage && (
                <div className="mt-2 text-sm text-red-700">
                  Error: {live.errorMessage}
                </div>
              )}
            </div>
          </>
        )}

        <Divider />
        <div className="flex items-center justify-between mt-4">
          <Heading level={3} className="mb-0!">
            Run History
          </Heading>
          <Button
            type="button"
            variant="primary"
            icon={<IconRefresh />}
            loading={runsLoading}
            onClick={() => refetchRuns()}
          >
            Refresh
          </Button>
        </div>
        <DataTable<BookBotRun>
          data={runs || []}
          columns={columns}
          loading={runsLoading}
          density="compact"
          enablePagination
          pageSize={itemsPerPage}
          pageSizeOptions={[10, 25, 50, 100]}
          tableOptions={{
            manualPagination: true,
            manualFiltering: true,
            manualSorting: true,
            rowCount: totalItems,
            state: { pagination: paginationState },
            onPaginationChange: (updater) => {
              const next =
                typeof updater === "function"
                  ? updater(paginationState)
                  : updater;
              setActivePage(next.pageIndex + 1);
              setItemsPerPage(next.pageSize);
            },
          }}
        />
      </Stack>

      <Modal
        open={!!viewingJobID}
        onClose={() => setViewingJobID(null)}
        size="lg"
      >
        <Modal.Header>
          <Modal.Title>Run Details</Modal.Title>
          <Modal.Close aria-label="Close run details" />
        </Modal.Header>
        <Modal.Body>
          {modalRun.isLoading && <Text>Loading…</Text>}
          {modalRun.data && (
            <Stack direction="vertical" gap="sm">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <strong>Job ID:</strong> <code>{modalRun.data.jobID}</code>
                </div>
                <div>
                  <strong>State:</strong>{" "}
                  <Badge
                    variant={STATE_VARIANT[modalRun.data.state]}
                    label={prettyState(modalRun.data.state)}
                  />
                </div>
                <div>
                  <strong>Triggered By:</strong> {modalRun.data.triggeredBy}
                </div>
                <div>
                  <strong>LibreTexts User:</strong> {modalRun.data.libreUser}
                </div>
                <div>
                  <strong>Started:</strong> {formatTs(modalRun.data.createdAt)}
                </div>
                <div>
                  <strong>Ended:</strong> {formatTs(modalRun.data.endedAt)}
                </div>
                <div className="col-span-2">
                  <strong>Root URL:</strong>{" "}
                  <a
                    href={modalRun.data.rootURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-700"
                  >
                    {modalRun.data.rootURL}
                  </a>
                </div>
                {modalRun.data.errorMessage && (
                  <div className="col-span-2 text-red-700">
                    <strong>Error:</strong> {modalRun.data.errorMessage}
                  </div>
                )}
              </div>
              <Divider />
              <Heading level={4}>State Log</Heading>
              <div className="bg-gray-900 text-gray-100 font-mono text-xs rounded-md p-3 max-h-64 overflow-auto whitespace-pre-wrap">
                {modalRun.data.logs?.length
                  ? modalRun.data.logs.map((entry, i) => (
                      <div key={i}>
                        <span className="text-gray-400">
                          [{formatTs(entry.ts)}]
                        </span>{" "}
                        <span className="text-yellow-300">
                          {prettyState(entry.state)}
                        </span>
                        {typeof entry.percentage === "number"
                          ? ` (${entry.percentage}%)`
                          : ""}
                        {entry.message ? `: ${entry.message}` : ""}
                      </div>
                    ))
                  : "(no logs)"}
              </div>
              <Heading level={4}>
                Verbose Output ({modalRun.data.messages?.length ?? 0})
              </Heading>
              <div
                ref={modalMessagesScrollRef}
                className="bg-gray-900 text-green-200 font-mono text-xs rounded-md p-3 max-h-80 overflow-auto whitespace-pre-wrap"
              >
                {modalRun.data.messages?.length
                  ? modalRun.data.messages.map((m, i) => <div key={i}>{m}</div>)
                  : "(no verbose output)"}
              </div>
              {modalRun.data.pages?.length > 0 && (
                <>
                  <Heading level={4}>Pages ({modalRun.data.pages.length})</Heading>
                  <div className="max-h-48 overflow-auto border border-gray-200 rounded-md">
                    <ul className="divide-y divide-gray-100 text-sm">
                      {modalRun.data.pages.map((p, i) => (
                        <li key={i} className="px-3 py-1.5">
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-blue-700"
                          >
                            {p.path}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </Stack>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default EditorPreprocess;
