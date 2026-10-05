import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, vi } from "vitest";
import EditCollection from "./EditCollection";
import {
  Collection,
  CollectionSyncMode,
  MAX_COLLECTION_SYNC_SHELVES,
} from "../../../types";

const mockPost = vi.hoisted(() => vi.fn());
const mockPut = vi.hoisted(() => vi.fn());
const mockHandleGlobalError = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: { post: mockPost, put: mockPut },
}));

vi.mock("../../../api", () => ({
  default: {
    getLibraries: vi.fn(async () => ({ data: { libraries: [] } })),
    getLibraryShelves: vi.fn(async () => ({ shelves: [] })),
    findShelfAcrossLibraries: vi.fn(),
  },
}));

vi.mock("../../../state/hooks.js", () => ({
  useTypedSelector: vi.fn(() => ({ shortName: "LibreTexts" })),
}));

vi.mock("../../error/ErrorHooks", () => ({
  default: () => ({ handleGlobalError: mockHandleGlobalError }),
}));

vi.mock("../../../context/NotificationContext", () => ({
  useNotifications: () => ({ addNotification: vi.fn() }),
}));

/** A collection still on the retired program meta-tag rule. */
const legacyCollection: Collection = {
  orgID: "libretexts",
  collID: "abcd1234",
  title: "OpenStax",
  description: "",
  coverPhoto: "",
  privacy: "public" as Collection["privacy"],
  resources: [],
  program: "openstax",
  locations: ["central"],
  autoManage: true,
  syncMode: CollectionSyncMode.PROGRAM,
  syncShelves: [],
};

const renderDialog = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>
  );

describe("EditCollection sync configuration", () => {
  beforeEach(() => {
    mockPost.mockReset().mockResolvedValue({ data: { err: false } });
    mockPut.mockReset().mockResolvedValue({ data: { err: false } });
    mockHandleGlobalError.mockReset();
  });

  it("shows a legacy program collection's rule read-only", async () => {
    renderDialog(
      <EditCollection
        show
        mode="edit"
        collectionToEdit={legacyCollection}
        onCloseFunc={() => {}}
        onSuccessFunc={() => {}}
      />
    );

    expect(await screen.findByText("openstax")).toBeInTheDocument();
    expect(screen.getByText(/Central Bookshelves/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Program Meta-Tag/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Switch to Library Shelves/i })
    ).toBeInTheDocument();
  });

  /* The important one. The server refuses `syncMode: "program"`, and it reads an
     absent syncMode as "leave the stored rule alone". A payload that carried
     either the mode or an empty shelf list would fail the save or wipe the rule
     of every collection still being migrated off it. */
  it("sends no sync fields when saving a legacy collection", async () => {
    const user = userEvent.setup();
    renderDialog(
      <EditCollection
        show
        mode="edit"
        collectionToEdit={legacyCollection}
        onCloseFunc={() => {}}
        onSuccessFunc={() => {}}
      />
    );

    await user.click(await screen.findByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(mockPut).toHaveBeenCalled());

    const body = mockPut.mock.calls[0][1];
    expect(body.title).toBe("OpenStax");
    expect(body).not.toHaveProperty("syncMode");
    expect(body).not.toHaveProperty("program");
    expect(body).not.toHaveProperty("locations");
    expect(body).not.toHaveProperty("syncShelves");
  });

  it("swaps the frozen rule for the shelf picker once converted", async () => {
    const user = userEvent.setup();
    renderDialog(
      <EditCollection
        show
        mode="edit"
        collectionToEdit={legacyCollection}
        onCloseFunc={() => {}}
        onSuccessFunc={() => {}}
      />
    );

    await user.click(
      await screen.findByRole("button", { name: /Switch to Library Shelves/i })
    );
    expect(await screen.findByText(/Selected Shelves/i)).toBeInTheDocument();
    expect(screen.queryByText("openstax")).toBeNull();

    // An auto-managed collection with no shelves syncs nothing, so the save is
    // refused rather than quietly stored.
    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() =>
      expect(screen.getByText(/At least one shelf is required/i)).toBeInTheDocument()
    );
    expect(mockPut).not.toHaveBeenCalled();
  });

  /* A manual collection created before sync modes existed has no `syncMode` and
     no program, and the migration only stamped auto-managed ones. Passing that
     empty mode through would store the shelves under no rule at all, and the
     sync would fall back to the program rule and match nothing. */
  it("asserts the shelves mode on a collection that has none stored", async () => {
    const user = userEvent.setup();
    const preSyncModes: Collection = {
      ...legacyCollection,
      title: "Hand-Picked",
      program: "",
      locations: [],
      autoManage: true,
      syncMode: undefined,
      syncShelves: [{ library: "chem", path: "Bookshelves/Organic_Chemistry" }],
    };

    renderDialog(
      <EditCollection
        show
        mode="edit"
        collectionToEdit={preSyncModes}
        onCloseFunc={() => {}}
        onSuccessFunc={() => {}}
      />
    );

    await user.click(await screen.findByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(mockPut).toHaveBeenCalled());

    expect(mockPut.mock.calls[0][1].syncMode).toBe(CollectionSyncMode.SHELVES);
  });

  /* The shelves are submitted whether or not automatic management is on, and the
     server caps the array either way — so the ceiling cannot be checked behind
     the autoManage guard the minimum sits behind. */
  it("blocks a save over the shelf cap even with automatic management off", async () => {
    const user = userEvent.setup();
    const overCap: Collection = {
      ...legacyCollection,
      title: "Too Many",
      program: "",
      locations: [],
      autoManage: false,
      syncMode: CollectionSyncMode.SHELVES,
      syncShelves: Array.from({ length: MAX_COLLECTION_SYNC_SHELVES + 4 }, (_, i) => ({
        library: "chem",
        path: `Bookshelves/Subject_${i}`,
      })),
    };

    renderDialog(
      <EditCollection
        show
        mode="edit"
        collectionToEdit={overCap}
        onCloseFunc={() => {}}
        onSuccessFunc={() => {}}
      />
    );

    await user.click(await screen.findByRole("button", { name: /^Save$/ }));

    await waitFor(() => expect(mockHandleGlobalError).toHaveBeenCalled());
    expect(mockHandleGlobalError.mock.calls[0][0]).toContain(
      `at most ${MAX_COLLECTION_SYNC_SHELVES} shelves`
    );
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("offers only shelves on create", async () => {
    renderDialog(
      <EditCollection
        show
        mode="create"
        onCloseFunc={() => {}}
        onSuccessFunc={() => {}}
      />
    );

    expect(await screen.findByText(/Selected Shelves/i)).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByText(/Program Meta-Tag/i)).toBeNull();
  });
});
