import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { TableOfContents } from "../../../../types/Book";
import Configure, { type ConfigureSettings } from "./Configure";
import { REFERENCE_BACKMATTER_TARGET } from "../model";

const bookToc: TableOfContents = {
  id: "book-root",
  title: "Book",
  url: "",
  children: [
    {
      id: "chapter-1",
      title: "Chapter 1",
      url: "",
      children: [
        { id: "page-1", title: "Page 1", url: "", children: [] },
        { id: "page-2", title: "Page 2", url: "", children: [] },
      ],
    },
    { id: "chapter-2", title: "Chapter 2", url: "", children: [] },
  ],
};

const groupList = () =>
  within(screen.getByRole("list", { name: "Reference groups" }));

function renderConfigure(
  props: Partial<Parameters<typeof Configure>[0]> = {},
) {
  const onSubmit = vi.fn<(settings: ConfigureSettings) => Promise<void>>(
    async () => {},
  );
  const onClose = vi.fn();
  const utils = render(
    <Configure
      open
      onClose={onClose}
      format="APA"
      bookToc={bookToc}
      onSubmit={onSubmit}
      addNotification={vi.fn()}
      {...props}
    />,
  );
  return { ...utils, onSubmit, onClose };
}

const lastSaved = (onSubmit: ReturnType<typeof renderConfigure>["onSubmit"]) =>
  onSubmit.mock.calls.at(-1)![0];

describe("Configure (reference scope)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a saved scope's groups", () => {
    renderConfigure({
      scopeMode: "CHAPTER",
      scopeGroups: [
        {
          groupID: "g1",
          pageIds: ["chapter-1", "page-1", "page-2", "chapter-2"],
          targetPageId: "chapter-2",
        },
      ],
    });

    expect(screen.getByRole("radio", { name: /references by chapter/i })).toBeChecked();
    // One merged group. Chapter mode has no target to show or choose: the
    // list always displays on the group's first page.
    expect(groupList().getAllByRole("listitem")).toHaveLength(1);
    expect(groupList().queryByText(/displays on/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /set target/i }),
    ).not.toBeInTheDocument();
  });

  it("starts an unsaved scope from the legacy display location", () => {
    renderConfigure({ displayLocation: "endOfChapter" });

    expect(screen.getByRole("radio", { name: /references by chapter/i })).toBeChecked();
    // Default chapter mode: one group per top-level chapter.
    expect(groupList().getAllByRole("listitem")).toHaveLength(2);
  });

  it("saves one group per page, each shown on itself, in page mode", async () => {
    const user = userEvent.setup();
    const { onSubmit, onClose } = renderConfigure();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const saved = lastSaved(onSubmit);
    expect(saved.mode).toBe("PAGE");
    expect(saved.format).toBe("APA");
    expect(saved.groups.map((g) => [g.pageIds, g.targetPageId])).toEqual([
      [["chapter-1"], "chapter-1"],
      [["page-1"], "page-1"],
      [["page-2"], "page-2"],
      [["chapter-2"], "chapter-2"],
    ]);
    // Only the scope fields are sent, not react-hook-form's row ids.
    expect(Object.keys(saved.groups[0]).sort()).toEqual([
      "groupID",
      "pageIds",
      "targetPageId",
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it("needs a page title in back matter mode and targets the back-matter page", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderConfigure();

    await user.click(screen.getByRole("radio", { name: /backmatter references page/i }));
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText("Page title"), "Works Cited");
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const saved = lastSaved(onSubmit);
    expect(saved.mode).toBe("BACKMATTER");
    expect(saved.pageTitle).toBe("Works Cited");
    expect(saved.groups).toHaveLength(1);
    expect(saved.groups[0].pageIds).toEqual([
      "chapter-1",
      "page-1",
      "page-2",
      "chapter-2",
    ]);
    // No back-matter page yet: the placeholder the populate job resolves.
    expect(saved.groups[0].targetPageId).toBe(REFERENCE_BACKMATTER_TARGET);
  });

  it("targets the existing back-matter References page once there is one", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderConfigure({
      backmatterPageID: "refs-page",
      pageTitle: "References",
    });

    await user.click(screen.getByRole("radio", { name: /backmatter references page/i }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(lastSaved(onSubmit).groups[0].targetPageId).toBe("refs-page");
  });

  it("stays open with its edits when saving fails", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => {
      throw new Error("boom");
    });
    const { onClose } = renderConfigure({ onSubmit });

    await user.click(screen.getByRole("radio", { name: /references by chapter/i }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: /references by chapter/i })).toBeChecked();
  });

  it("can't save until the table of contents has loaded", () => {
    renderConfigure({ bookToc: undefined });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
