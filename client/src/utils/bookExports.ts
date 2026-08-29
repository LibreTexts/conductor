import {
  IconBook,
  IconFileTypePdf,
  IconFileZip,
  IconPackage,
} from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import type { BookExportGroup, BookExportKey } from "../types/Shapeshift";

export interface BookExportDisplay {
  key: BookExportKey;
  label: string;
  group: BookExportGroup;
  /**
   * Whether the browser can render this export inline.
   *
   * Read from here, never inferred from the download URL's extension at render
   * time. Two exports can share the `.pdf` suffix and still differ in how the
   * detail pane should treat them.
   */
  previewable: boolean;
  /**
   * Whether the export exists at all. EPUB stays `false` until Shapeshift
   * produces one.
   */
  enabled: boolean;
  icon: Icon;
  description: string;
}

export const BOOK_EXPORT_GROUP_LABELS: Record<BookExportGroup, string> = {
  "full-book": "Full book",
  publication: "Publication",
  other: "Other formats",
};

/**
 * Presentation half of the export registry. The server half, in
 * `server/api/services/book-export-service.ts`, owns download URLs and probing;
 * the two share the `BookExportKey` union and must stay in step.
 */
export const BOOK_EXPORT_DISPLAY: BookExportDisplay[] = [
  {
    key: "full-pdf",
    label: "Full PDF",
    group: "full-book",
    previewable: true,
    enabled: true,
    icon: IconFileTypePdf,
    description:
      "The entire book, including front and back matter, as a single PDF.",
  },
  {
    key: "content-pdf",
    label: "Content PDF",
    group: "publication",
    previewable: true,
    enabled: true,
    icon: IconFileTypePdf,
    description: "The book's interior pages, formatted for print production.",
  },
  {
    key: "cover-perfectbound",
    label: "Paperback Cover PDF",
    group: "publication",
    previewable: true,
    enabled: true,
    icon: IconBook,
    description: "Wraparound cover sized for a paperback printing.",
  },
  {
    key: "cover-casewrap",
    label: "Hardcover Cover PDF",
    group: "publication",
    previewable: true,
    enabled: true,
    icon: IconBook,
    description: "Wraparound cover sized for a hardcover printing.",
  },
  {
    key: "thincc",
    label: "ThinCC",
    group: "full-book",
    previewable: false,
    enabled: true,
    icon: IconPackage,
    description:
      "A Common Cartridge package for importing this book into Canvas, Moodle, Blackboard, or D2L.",
  },
  {
    key: "page-pdfs",
    label: "Page PDFs",
    group: "other",
    previewable: false,
    enabled: true,
    icon: IconFileZip,
    description: "A ZIP archive containing one PDF per page of the book.",
  },
  {
    key: "epub",
    label: "EPUB",
    group: "other",
    previewable: false,
    enabled: false,
    icon: IconBook,
    description: "Reflowable EPUB. Coming soon.",
  },
];

export const getExportDisplay = (
  key: BookExportKey,
): BookExportDisplay | undefined =>
  BOOK_EXPORT_DISPLAY.find((e) => e.key === key);

/**
 * The registry split into the rail's three sections, preserving definition
 * order within each.
 */
export const getGroupedExports = (): {
  group: BookExportGroup;
  label: string;
  items: BookExportDisplay[];
}[] =>
  (["full-book", "publication", "other"] as BookExportGroup[])
    .map((group) => ({
      group,
      label: BOOK_EXPORT_GROUP_LABELS[group],
      items: BOOK_EXPORT_DISPLAY.filter((e) => e.group === group),
    }))
    .filter((g) => g.items.length > 0);

/**
 * The export the drawer opens on: the first one that actually exists, falling
 * back to the first defined export so the pane is never empty.
 */
export const getDefaultExportKey = (
  availableKeys: BookExportKey[],
): BookExportKey => {
  const firstAvailable = BOOK_EXPORT_DISPLAY.find((e) =>
    availableKeys.includes(e.key),
  );
  return firstAvailable?.key ?? BOOK_EXPORT_DISPLAY[0].key;
};
