import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createColumnHelper } from "@libretexts/davis-react-table";
import LicenseTable, { ROW_HEADER_COLUMN_ID } from "./LicenseTable";
import LicenseEditor from "./LicenseEditor";

type Row = { id: string; title: string; status: string };

const columnHelper = createColumnHelper<Row>();
const columns = [
  columnHelper.accessor("title", {
    id: ROW_HEADER_COLUMN_ID,
    header: "Page Title",
    cell: ({ getValue }) => getValue(),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ getValue }) => getValue(),
  }),
];

describe("LicenseTable", () => {
  it("exposes the page title column as row headers", () => {
    render(
      <LicenseTable<Row>
        data={[
          { id: "1", title: "Front Matter", status: "ok" },
          { id: "2", title: "Chapter 1", status: "conflict" },
        ]}
        columns={columns}
        caption="License compliance by page"
      />,
    );

    const table = screen.getByRole("table", {
      name: "License compliance by page",
    });
    const rowHeaders = within(table).getAllByRole("rowheader");
    expect(rowHeaders.map((cell) => cell.textContent)).toEqual([
      "Front Matter",
      "Chapter 1",
    ]);
    // Other columns stay ordinary cells.
    expect(within(table).getByRole("cell", { name: "conflict" })).toBeTruthy();
  });
});

describe("LicenseEditor", () => {
  it("names the edit button with its visible text and the page", () => {
    render(
      <LicenseEditor
        field="page"
        pageTitle="Chapter 1"
        editable
        onSubmit={() => {}}
      />,
    );

    // Visible "Not set" comes first (label in name), then the context.
    expect(
      screen.getByRole("button", {
        name: "Not set, edit page license for Chapter 1",
      }),
    ).toBeTruthy();
  });

  it("names Save and Cancel with the page while editing", () => {
    render(
      <LicenseEditor
        field="book"
        pageTitle="Chapter 1"
        editable
        isEditing
        onSubmit={() => {}}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Save book license for Chapter 1" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Cancel editing book license for Chapter 1",
      }),
    ).toBeTruthy();
    // Selects are named by their visible labels, not an aria-label override.
    expect(screen.getByRole("combobox", { name: "License" })).toBeTruthy();
  });
});
