import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AssetInfoModal from "./AssetInfoModal";
import { ProjectFile } from "../../types";

const baseFile: ProjectFile = {
  fileID: "F1",
  projectID: "P1",
  name: "Syllabus.pdf",
  access: "public",
  storageType: "file",
  size: 2048,
  description: "",
  parent: "",
  createdBy: "u1",
  downloadCount: 0,
};

describe("AssetInfoModal", () => {
  it("links the license when it has a URL", () => {
    render(
      <AssetInfoModal
        file={{ ...baseFile, license: { name: "CC BY", version: "4.0", url: "https://creativecommons.org/licenses/by/4.0/" } }}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole("link", { name: "CC BY 4.0" })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by/4.0/"
    );
  });

  it("shows plain license text and omits empty rows", () => {
    render(<AssetInfoModal file={{ ...baseFile, license: { name: "CC0" } }} onClose={vi.fn()} />);
    expect(screen.getByText("CC0")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("Primary Author")).not.toBeInTheDocument();
    expect(screen.queryByText("Original Publisher")).not.toBeInTheDocument();
  });
});
