import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TreeNodeContainer from "./BookContent/TreeNodeContainer";
import ContextMenu from "./BookContent/ContextMenu";
import CatalogList from "./CatalogBook/CatalogList";
import ConsultInsightButton from "../NextGenComponents/ConsultInsightButton";
import type { RemixerSubPage } from "./model";
import type { Book } from "../../types";

const palette = {
  info: "#00f",
  infoBg: "#eef",
  error: "#f00",
  errorBg: "#fee",
  success: "#0f0",
  successBg: "#efe",
  warning: "#fa0",
  warningBg: "#ffe",
};

const page = {
  "@id": "42",
  "@title": "Chapter 1",
  title: "Chapter 1",
  "uri.ui": "https://chem.libretexts.org/Bookshelves/Chapter_1",
} as unknown as RemixerSubPage;

const noop = () => {};

function renderRow(overrides: Partial<React.ComponentProps<typeof TreeNodeContainer>> = {}) {
  return render(
    <TreeNodeContainer
      page={page}
      isFolder
      isExpanded={false}
      isDeleted={false}
      isImported={false}
      isRenamed={false}
      isPlacementChanged={false}
      isSelected={false}
      isBookTree
      itemLink={page["uri.ui"]}
      displayTitle="Chapter 1"
      isDropInside={false}
      isDropBefore={false}
      isDropAfter={false}
      palette={palette}
      onToggleFolder={noop}
      onDragStart={noop}
      onDragEnd={noop}
      onDragOver={noop}
      onDragLeave={noop}
      onDrop={noop}
      onSelect={noop}
      {...overrides}
    />,
  );
}

describe("Remixer tree row", () => {
  it("exposes expand/collapse as a keyboard button with state", () => {
    const onToggleFolder = vi.fn();
    renderRow({ onToggleFolder });
    const toggle = screen.getByRole("button", { name: "Expand Chapter 1" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(onToggleFolder).toHaveBeenCalledWith(page);
  });

  it("names the icon-only page link", () => {
    renderRow();
    expect(
      screen.getByRole("link", { name: "Open Chapter 1 (opens in new tab)" }),
    ).toBeTruthy();
  });

  it("names the status icons", () => {
    // Imported book-tree items have no live page yet, so no link is shown.
    renderRow({ isRenamed: true, isImported: true });
    expect(screen.getByRole("img", { name: "Modified (moved or renamed)" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Added" })).toBeTruthy();
  });

  it("offers a keyboard-reachable Actions button", () => {
    const onOpenActions = vi.fn();
    renderRow({ onOpenActions });
    const button = screen.getByRole("button", { name: "Actions for Chapter 1" });
    fireEvent.click(button);
    expect(onOpenActions).toHaveBeenCalledWith(page, button);
  });
});

describe("Remixer context menu", () => {
  it("is a named menu with menuitems, closes on Escape and lists Duplicate", () => {
    const onClose = vi.fn();
    render(
      <ContextMenu
        contextMenu={{ nodeId: "42", x: 0, y: 0 }}
        canAddSibling
        canDuplicate={false}
        duplicateUnavailableReason="not available for items with subpages"
        isDeleted={false}
        addAboveLabel="Add Page Above"
        addToLabel="Add Page To"
        addBelowLabel="Add Page Below"
        label="Actions for Chapter 1"
        onAction={noop}
        onClose={onClose}
      />,
    );
    const menu = screen.getByRole("menu", { name: "Actions for Chapter 1" });
    const duplicate = within(menu).getByRole("menuitem", {
      name: "Duplicate (not available for items with subpages)",
    });
    expect((duplicate as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Catalog Book modal", () => {
  const books = [
    { bookID: "chem-1", title: "General Chemistry", library: "chem", author: "A", course: "X", license: "ccby" },
    { bookID: "bio-2", title: "Biology Basics", library: "bio", author: "B", course: "Y", license: "ccby" },
  ] as unknown as Book[];

  it("uses a heading, radio selection, row headers and sort buttons", () => {
    render(
      <CatalogList open onClose={noop} dimmer="" catalogBook={books} loadSelectedBook={noop} />,
    );

    expect(screen.getByRole("heading", { name: "Catalog Book" })).toBeTruthy();

    const table = screen.getByRole("table", { name: "Catalog books" });
    expect(
      within(table).getAllByRole("rowheader").map((c) => c.textContent),
    ).toEqual(["General Chemistry", "Biology Basics"]);

    const radio = within(table).getByRole("radio", { name: "Select Biology Basics" });
    fireEvent.click(radio);
    expect((radio as HTMLInputElement).checked).toBe(true);

    expect(within(table).getByRole("button", { name: "Title, sortable" })).toBeTruthy();
  });
});

describe("ConsultInsightButton", () => {
  it("is a single link with a descriptive name", () => {
    render(<ConsultInsightButton href="https://commons.libretexts.org/insight/x" />);
    expect(
      screen.getByRole("link", {
        name: "Consult Insight Knowledge Base (opens in new tab)",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
