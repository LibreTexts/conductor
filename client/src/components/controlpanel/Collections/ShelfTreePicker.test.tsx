import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, vi } from "vitest";
import ShelfTreePicker from "./ShelfTreePicker";
import {
  CollectionShelf,
  MAX_COLLECTION_SYNC_SHELVES,
} from "../../../types";
import sharedLimits from "../../../../../shared/collection-limits.json";

const mockAddNotification = vi.hoisted(() => vi.fn());
const mockFindAcross = vi.hoisted(() => vi.fn());

vi.mock("../../../api", () => ({
  default: {
    getLibraries: vi.fn(async () => ({
      data: {
        libraries: [
          { subdomain: "chem", title: "Chemistry", syncSupported: true },
          // Commons never walks this one, so its shelves must not be offerable.
          { subdomain: "espanol", title: "Espanol", syncSupported: false },
        ],
      },
    })),
    getLibraryShelves: vi.fn(async (_subdomain: string, path?: string) =>
      path
        ? { shelves: [] }
        : {
            shelves: [
              { title: "Bookshelves", path: "Bookshelves", hasChildren: true },
              { title: "Courses", path: "Courses", hasChildren: true },
            ],
          }
    ),
    findShelfAcrossLibraries: mockFindAcross,
  },
}));

vi.mock("../../error/ErrorHooks", () => ({
  default: () => ({ handleGlobalError: vi.fn() }),
}));

vi.mock("../../../context/NotificationContext", () => ({
  useNotifications: () => ({ addNotification: mockAddNotification }),
}));

const renderPicker = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>
  );

/** Expands the one library in the tree and returns its cross-library button. */
const openCoursesRow = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: /Expand Chemistry/i }));
  return screen.findByRole("button", {
    name: "Add Courses across all libraries",
  });
};

describe("ShelfTreePicker", () => {
  beforeEach(() => {
    mockAddNotification.mockReset();
    mockFindAcross.mockReset();
  });

  it("lists only sync-supported libraries", async () => {
    renderPicker(<ShelfTreePicker value={[]} onChange={vi.fn()} />);
    expect(await screen.findByText("Chemistry")).toBeInTheDocument();
    expect(screen.queryByText("Espanol")).toBeNull();
  });

  it("adds the path in every library that has it and reports the count", async () => {
    const user = userEvent.setup();
    mockFindAcross.mockResolvedValue({
      err: false,
      path: "Courses",
      checked: 13,
      matches: [
        { library: "bio", path: "Courses" },
        { library: "eng", path: "Courses" },
      ],
    });
    const onChange = vi.fn();
    renderPicker(<ShelfTreePicker value={[]} onChange={onChange} />);

    await user.click(await openCoursesRow(user));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0]).toEqual([
      { library: "bio", path: "Courses" },
      { library: "eng", path: "Courses" },
    ]);
    expect(mockAddNotification).toHaveBeenCalledWith({
      type: "success",
      message: "Courses added across 2 libraries!",
    });
  });

  /* Most libraries not carrying a given campus or subject shelf is the normal
     answer here, so it reports rather than erroring. */
  it("says so when no library carries the path", async () => {
    const user = userEvent.setup();
    mockFindAcross.mockResolvedValue({
      err: false,
      path: "Courses",
      checked: 13,
      matches: [],
    });
    const onChange = vi.fn();
    renderPicker(<ShelfTreePicker value={[]} onChange={onChange} />);

    await user.click(await openCoursesRow(user));

    await waitFor(() => expect(mockAddNotification).toHaveBeenCalled());
    expect(mockAddNotification).toHaveBeenCalledWith({
      type: "info",
      message: "Courses wasn't found in any other library.",
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  /* The lookup takes about a second against the real libraries and the tree
     stays usable while it runs. Merging into the selection as it was when the
     button was pressed would silently drop whatever was checked in between. */
  it("keeps a shelf checked while the lookup is in flight", async () => {
    const user = userEvent.setup();
    let resolveLookup: (value: unknown) => void = () => {};
    mockFindAcross.mockReturnValue(
      new Promise((resolve) => {
        resolveLookup = resolve;
      })
    );

    const Harness = () => {
      const [value, setValue] = useState<CollectionShelf[]>([]);
      return <ShelfTreePicker value={value} onChange={setValue} />;
    };
    renderPicker(<Harness />);

    await user.click(await openCoursesRow(user));

    // Check an unrelated shelf while the request is still outstanding.
    await user.click(screen.getByRole("checkbox", { name: "Bookshelves" }));
    expect(await screen.findByText("chem: Bookshelves")).toBeInTheDocument();

    resolveLookup({
      err: false,
      path: "Courses",
      checked: 13,
      matches: [{ library: "bio", path: "Courses" }],
    });

    expect(await screen.findByText("bio: Courses")).toBeInTheDocument();
    expect(screen.getByText("chem: Bookshelves")).toBeInTheDocument();
  });

  /* The server caps the array at 50 and a few cross-library adds reach that, so
     the ceiling has to be refused here with a message that names it. */
  it("refuses a cross-library add that would exceed the shelf cap", async () => {
    const user = userEvent.setup();
    mockFindAcross.mockResolvedValue({
      err: false,
      path: "Courses",
      checked: 13,
      matches: Array.from({ length: 6 }, (_, i) => ({
        library: `lib${i}`,
        path: "Courses",
      })),
    });
    const filled: CollectionShelf[] = Array.from(
      { length: MAX_COLLECTION_SYNC_SHELVES - 3 },
      (_, i) => ({ library: "chem", path: `Bookshelves/Subject_${i}` })
    );
    const onChange = vi.fn();
    renderPicker(<ShelfTreePicker value={filled} onChange={onChange} />);

    await user.click(await openCoursesRow(user));

    await waitFor(() => expect(mockAddNotification).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
    const [{ type, message }] = mockAddNotification.mock.calls[0];
    expect(type).toBe("error");
    expect(message).toContain(`at most ${MAX_COLLECTION_SYNC_SHELVES} shelves`);
  });

  /* Proves the chain from shared/collection-limits.json through the exported
     constant to what the admin sees. The limit used to be written out twice,
     once here and once in the server validator, and a drift between them is
     invisible until a save fails. */
  it("shows the shared cap in the selection count", async () => {
    renderPicker(
      <ShelfTreePicker
        value={[{ library: "chem", path: "Courses" }]}
        onChange={vi.fn()}
      />
    );
    expect(
      await screen.findByText(`(1 of ${sharedLimits.maxSyncShelves})`)
    ).toBeInTheDocument();
    expect(MAX_COLLECTION_SYNC_SHELVES).toBe(sharedLimits.maxSyncShelves);
  });

  it("refuses a single selection once the cap is reached", async () => {
    const user = userEvent.setup();
    const full: CollectionShelf[] = Array.from(
      { length: MAX_COLLECTION_SYNC_SHELVES },
      (_, i) => ({ library: "chem", path: `Bookshelves/Subject_${i}` })
    );
    const onChange = vi.fn();
    renderPicker(<ShelfTreePicker value={full} onChange={onChange} />);

    await user.click(await screen.findByRole("button", { name: /Expand Chemistry/i }));
    await user.click(await screen.findByRole("checkbox", { name: "Courses" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(mockAddNotification).toHaveBeenCalledWith({
      type: "error",
      message: `A collection can sync from at most ${MAX_COLLECTION_SYNC_SHELVES} shelves. Remove one before adding another.`,
    });
  });

  it("still allows deselecting at the cap", async () => {
    const user = userEvent.setup();
    const full: CollectionShelf[] = [
      { library: "chem", path: "Courses" },
      ...Array.from({ length: MAX_COLLECTION_SYNC_SHELVES - 1 }, (_, i) => ({
        library: "chem",
        path: `Bookshelves/Subject_${i}`,
      })),
    ];
    const onChange = vi.fn();
    renderPicker(<ShelfTreePicker value={full} onChange={onChange} />);

    await user.click(await screen.findByRole("button", { name: /Expand Chemistry/i }));
    await user.click(await screen.findByRole("checkbox", { name: "Courses" }));

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0]).toHaveLength(
      MAX_COLLECTION_SYNC_SHELVES - 1
    );
  });

  it("does not re-add shelves already selected", async () => {
    const user = userEvent.setup();
    mockFindAcross.mockResolvedValue({
      err: false,
      path: "Courses",
      checked: 13,
      matches: [{ library: "bio", path: "Courses" }],
    });
    const onChange = vi.fn();
    renderPicker(
      <ShelfTreePicker value={[{ library: "bio", path: "Courses" }]} onChange={onChange} />
    );

    await user.click(await openCoursesRow(user));

    await waitFor(() => expect(mockAddNotification).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
    expect(mockAddNotification).toHaveBeenCalledWith({
      type: "info",
      message: "Courses was already selected in every library that has it.",
    });
  });
});
