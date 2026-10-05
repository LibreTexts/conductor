import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UXAcknowledgmentEntry, WhatsNewEntry } from "../types";

const mockAcknowledge = vi.fn(() => Promise.resolve());

// The acknowledgment state the hook reads. Reassigned per test.
let ackState: {
  entry: UXAcknowledgmentEntry | null;
  ready: boolean;
} = { entry: null, ready: true };

vi.mock("./useUXAcknowledgment", () => ({
  default: () => ({ ...ackState, acknowledge: mockAcknowledge }),
}));

vi.mock("../api", () => ({
  default: { getActiveWhatsNew: vi.fn() },
}));

import api from "../api";
import useWhatsNew from "./useWhatsNew";

const ENTRY: WhatsNewEntry = {
  _id: "entry-2",
  title: "Batch-publish your books",
  body: "You can now publish several books at once.",
  publishedAt: "2026-09-01T00:00:00.000Z",
};

function ack(data?: Record<string, unknown>): UXAcknowledgmentEntry {
  return {
    status: "dismissed",
    firstSeenAt: "2026-08-01T00:00:00.000Z",
    lastSeenAt: "2026-08-01T00:00:00.000Z",
    viewCount: 1,
    dismissCount: 1,
    data,
  };
}

function renderUseWhatsNew() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderHook(() => useWhatsNew(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

function mockActive(entry: WhatsNewEntry | null) {
  vi.mocked(api.getActiveWhatsNew).mockResolvedValue({
    data: { err: false, entry },
  } as any);
}

describe("useWhatsNew", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    ackState = { entry: null, ready: true };
  });

  it("shows an entry the user has never acknowledged", async () => {
    mockActive(ENTRY);
    const { result } = renderUseWhatsNew();

    await waitFor(() => expect(result.current.shouldShow).toBe(true));
    expect(result.current.entry?._id).toBe("entry-2");
  });

  it("hides an entry whose id matches the stored watermark", async () => {
    mockActive(ENTRY);
    ackState = {
      entry: ack({
        lastEntryId: "entry-2",
        lastPublishedAt: ENTRY.publishedAt,
      }),
      ready: true,
    };
    const { result } = renderUseWhatsNew();

    await waitFor(() => expect(result.current.entry).not.toBeNull());
    expect(result.current.shouldShow).toBe(false);
  });

  it("shows a NEWER entry even though an older one was dismissed", async () => {
    mockActive(ENTRY);
    // The watermark points at a previous entry, so this one is still unseen.
    ackState = {
      entry: ack({
        lastEntryId: "entry-1",
        lastPublishedAt: "2026-06-01T00:00:00.000Z",
      }),
      ready: true,
    };
    const { result } = renderUseWhatsNew();

    await waitFor(() => expect(result.current.shouldShow).toBe(true));
  });

  it("stays hidden until the acknowledgment map is ready", async () => {
    mockActive(ENTRY);
    ackState = { entry: null, ready: false };
    const { result } = renderUseWhatsNew();

    await waitFor(() => expect(result.current.entry).not.toBeNull());
    expect(result.current.shouldShow).toBe(false);
  });

  it("shows nothing when the server has no active entry", async () => {
    mockActive(null);
    const { result } = renderUseWhatsNew();

    await waitFor(() => expect(result.current.entry).toBeNull());
    expect(result.current.shouldShow).toBe(false);
  });

  it("shows nothing and does not throw when the fetch fails", async () => {
    vi.mocked(api.getActiveWhatsNew).mockRejectedValue(new Error("boom"));
    const { result } = renderUseWhatsNew();

    await waitFor(() => expect(result.current.entry).toBeNull());
    expect(result.current.shouldShow).toBe(false);
  });

  it("records the dismissal as a watermark", async () => {
    mockActive(ENTRY);
    const { result } = renderUseWhatsNew();

    await waitFor(() => expect(result.current.shouldShow).toBe(true));
    result.current.dismiss();

    expect(mockAcknowledge).toHaveBeenCalledWith("dismissed", {
      lastEntryId: "entry-2",
      lastPublishedAt: ENTRY.publishedAt,
    });
  });

  it("does not show the same entry twice in one tab session", async () => {
    mockActive(ENTRY);
    const first = renderUseWhatsNew();
    await waitFor(() => expect(first.result.current.shouldShow).toBe(true));
    first.result.current.dismiss();

    // A fresh mount with the acknowledgment write still in flight (watermark
    // not yet visible) must not re-open the modal.
    const second = renderUseWhatsNew();
    await waitFor(() => expect(second.result.current.entry).not.toBeNull());
    expect(second.result.current.shouldShow).toBe(false);
  });
});
