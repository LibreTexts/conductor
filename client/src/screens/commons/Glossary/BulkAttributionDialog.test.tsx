import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../api", () => ({
  default: {
    bulkUpdateGlossaryAttribution: vi.fn(() =>
      Promise.resolve({ err: false, modifiedCount: 1 }),
    ),
  },
}));

import api from "../../../api";
import BulkAttributionDialog from "./BulkAttributionDialog";
import type { GlossaryEntry } from "./model";

const terms = [
  { usageID: "abcdefghij", term: "Cell", pages: [] },
] as unknown as GlossaryEntry[];

function renderDialog() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <BulkAttributionDialog
        open
        onClose={() => {}}
        library="bio"
        coverID="1"
        terms={terms}
        addNotification={() => {}}
        onUpdated={() => {}}
      />
    </QueryClientProvider>,
  );
}

describe("BulkAttributionDialog", () => {
  it("asks for and sends the license version", async () => {
    renderDialog();
    expect(screen.queryByRole("combobox", { name: /License Version/ })).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Source (License)" }), {
      target: { value: "ccby" },
    });
    const version = await screen.findByRole("combobox", { name: /License Version/ });
    fireEvent.change(version, { target: { value: "4.0" } });

    fireEvent.click(screen.getByRole("button", { name: /Apply to 1 Term/ }));
    await waitFor(() =>
      expect(api.bulkUpdateGlossaryAttribution).toHaveBeenCalledWith(
        expect.objectContaining({ source: "ccby", sourceVersion: "4.0" }),
      ),
    );
  });
});
