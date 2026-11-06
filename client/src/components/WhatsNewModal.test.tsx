import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockIsAuthenticated = vi.fn(() => true);

vi.mock("./util/AuthHelper", () => ({
  default: {
    isAuthenticated: () => mockIsAuthenticated(),
  },
  COOKIE_NAMES: { ACCESS: "conductor_access_v2", SIGNED: "conductor_signed_v2" },
}));

vi.mock("../api", () => ({
  default: {
    getActiveWhatsNew: vi.fn(() =>
      Promise.resolve({ data: { err: false, entry: null } })
    ),
    getUserUXAcknowledgments: vi.fn(() =>
      Promise.resolve({ data: { err: false, acknowledgments: {} } })
    ),
    recordUserUXAcknowledgment: vi.fn(),
  },
}));

import api from "../api";
import WhatsNewModal from "./WhatsNewModal";

function renderAt(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <WhatsNewModal />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * These assert on REQUESTS, not rendering. Both endpoints this feature uses sit
 * behind verifyRequest, and a 401 from either one trips the global interceptor
 * in Platform.tsx into logging the user out and redirecting to CAS. Firing them
 * on an anon route broke /fallback-auth once already.
 */
describe("WhatsNewModal request gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mockIsAuthenticated.mockReturnValue(true);
  });

  it("makes no authenticated request when there is no session cookie", async () => {
    mockIsAuthenticated.mockReturnValue(false);
    renderAt("/home");

    await waitFor(() => expect(api.getActiveWhatsNew).not.toHaveBeenCalled());
    expect(api.getUserUXAcknowledgments).not.toHaveBeenCalled();
  });

  it.each(["/login", "/fallback-auth"])(
    "makes no authenticated request on %s even with a session cookie",
    async (path) => {
      renderAt(path);

      await waitFor(() => expect(api.getActiveWhatsNew).not.toHaveBeenCalled());
      expect(api.getUserUXAcknowledgments).not.toHaveBeenCalled();
    }
  );

  it("fetches on a normal authenticated route", async () => {
    renderAt("/home");

    await waitFor(() => expect(api.getActiveWhatsNew).toHaveBeenCalled());
  });
});

const ACTIVE = {
  _id: "entry-2",
  title: "H5P authoring",
  body: "Create interactives in Conductor.",
  publishedAt: "2026-10-27T00:00:00.000Z",
};

describe("WhatsNewModal choices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mockIsAuthenticated.mockReturnValue(true);
    vi.mocked(api.getActiveWhatsNew).mockResolvedValue({ data: { err: false, entry: ACTIVE } } as any);
    vi.mocked(api.recordUserUXAcknowledgment).mockResolvedValue({
      data: { err: false, key: "whats_new", acknowledgment: null },
    } as any);
  });

  it("offers both choices and no close button", async () => {
    renderAt("/home");

    expect(await screen.findByRole("button", { name: "Remind me later" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Got it!" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dismiss|close/i })).toBeNull();
  });

  it("records a dismissal on Got it!", async () => {
    renderAt("/home");

    await userEvent.click(await screen.findByRole("button", { name: "Got it!" }));

    await waitFor(() =>
      expect(api.recordUserUXAcknowledgment).toHaveBeenCalledWith(
        "whats_new",
        expect.objectContaining({ status: "dismissed", data: expect.objectContaining({ lastEntryId: "entry-2" }) })
      )
    );
  });

  it("records a snooze on Remind me later", async () => {
    renderAt("/home");

    await userEvent.click(await screen.findByRole("button", { name: "Remind me later" }));

    await waitFor(() =>
      expect(api.recordUserUXAcknowledgment).toHaveBeenCalledWith(
        "whats_new",
        expect.objectContaining({ status: "seen", data: expect.objectContaining({ snoozedEntryId: "entry-2" }) })
      )
    );
  });

  it("snoozes on Escape", async () => {
    renderAt("/home");
    await screen.findByRole("button", { name: "Remind me later" });

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() =>
      expect(api.recordUserUXAcknowledgment).toHaveBeenCalledWith(
        "whats_new",
        expect.objectContaining({ status: "seen" })
      )
    );
  });

  it("stays open on a backdrop click", async () => {
    renderAt("/home");
    await screen.findByRole("button", { name: "Remind me later" });

    await userEvent.click(document.body);

    expect(screen.getByRole("button", { name: "Got it!" })).toBeInTheDocument();
    expect(api.recordUserUXAcknowledgment).not.toHaveBeenCalled();
  });
});
