import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("../../api", () => ({
  default: { getKBOEmbed: vi.fn() },
}));

import KBRenderer from "./KBRenderer";
import { slugifyHeading } from "../../utils/kbHeadings";

describe("slugifyHeading", () => {
  it("matches the server's rules", () => {
    expect(slugifyHeading("Embedding Summative Assessments")).toBe(
      "embedding-summative-assessments"
    );
    expect(slugifyHeading("Évaluation Générale")).toBe("evaluation-generale");
    expect(slugifyHeading("A & B")).toBe("a-b");
    // A leading digit is a legal id but needs escaping in querySelector.
    expect(slugifyHeading("2026 Roadmap")).toBe("section-2026-roadmap");
    expect(slugifyHeading("!!!")).toBe("section-1");
  });
});

describe("KBRenderer heading anchors", () => {
  it("keeps the id an article was saved with, so shared links survive renames", async () => {
    render(<KBRenderer content={`<h2 id="old-name">A New Title</h2>`} />);

    const heading = await screen.findByRole("heading", { level: 2 });
    expect(heading.id).toBe("old-name");
  });

  it("generates an id for a heading that has none", async () => {
    render(<KBRenderer content={`<h2>Embedding Summative Assessments</h2>`} />);

    const heading = await screen.findByRole("heading", { level: 2 });
    expect(heading.id).toBe("embedding-summative-assessments");
  });

  it("de-duplicates repeated heading text", async () => {
    render(
      <KBRenderer content={`<h2>Overview</h2><p>x</p><h2>Overview</h2>`} />
    );

    const headings = await screen.findAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.id)).toEqual(["overview", "overview-2"]);
  });

  it("reports its headings to the parent", async () => {
    const onHeadingsChange = vi.fn();
    render(
      <KBRenderer
        content={`<h2>First</h2><h3>Nested</h3><h4>Ignored</h4>`}
        onHeadingsChange={onHeadingsChange}
      />
    );

    await waitFor(() =>
      expect(onHeadingsChange).toHaveBeenLastCalledWith([
        { id: "first", text: "First", level: 2 },
        { id: "nested", text: "Nested", level: 3 },
      ])
    );
  });

  it("gives every heading a keyboard-reachable copy-link control", async () => {
    render(<KBRenderer content={`<h2>Embedding Summative Assessments</h2>`} />);

    const button = await screen.findByRole("button", {
      name: "Copy link to section: Embedding Summative Assessments",
    });
    // Revealed with opacity, never display:none — a hidden button is not tabbable.
    expect(button).toBeVisible();
  });
});
