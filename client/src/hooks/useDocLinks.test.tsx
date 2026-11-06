import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../api", () => ({
  default: { getKBDocLinks: vi.fn() },
}));

import api from "../api";
import useDocLinks from "./useDocLinks";
import ConsultInsightButton from "../components/NextGenComponents/ConsultInsightButton";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useDocLinks", () => {
  beforeEach(() => {
    vi.mocked(api.getKBDocLinks).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("maps doc keys to full Insight URLs", async () => {
    vi.mocked(api.getKBDocLinks).mockResolvedValue({
      data: { err: false, links: { REMIXER: "the-remixer" } },
    } as any);

    const { result } = renderHook(() => useDocLinks(), { wrapper });

    await waitFor(() =>
      expect(result.current.docLinks.REMIXER).toBe(
        "https://commons.libretexts.org/insight/the-remixer",
      ),
    );
  });

  it("resolves to an empty map when the request fails", async () => {
    vi.mocked(api.getKBDocLinks).mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useDocLinks(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.docLinks).toEqual({});
  });
});

describe("ConsultInsightButton with a docKey", () => {
  beforeEach(() => {
    vi.mocked(api.getKBDocLinks).mockReset();
  });

  it("links to the page for a known key", async () => {
    vi.mocked(api.getKBDocLinks).mockResolvedValue({
      data: { err: false, links: { BOOKS_MANAGER: "books-manager" } },
    } as any);

    render(<ConsultInsightButton docKey="BOOKS_MANAGER" />, { wrapper });

    const link = await screen.findByRole("link", {
      name: "Consult Insight Knowledge Base (opens in new tab)",
    });
    expect(link.getAttribute("href")).toBe(
      "https://commons.libretexts.org/insight/books-manager",
    );
  });

  it("renders nothing for a key the server doesn't return", async () => {
    vi.mocked(api.getKBDocLinks).mockResolvedValue({
      data: { err: false, links: {} },
    } as any);

    render(<ConsultInsightButton docKey="REFERENCE_MANAGER" />, { wrapper });

    await waitFor(() => expect(api.getKBDocLinks).toHaveBeenCalled());
    expect(screen.queryByRole("link")).toBeNull();
  });
});
