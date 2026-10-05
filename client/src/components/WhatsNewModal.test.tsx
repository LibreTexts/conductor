import { render, waitFor } from "@testing-library/react";
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
