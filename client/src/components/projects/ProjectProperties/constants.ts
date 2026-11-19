export const DESCRIP_MAX_CHARS = 500;

export type PropertiesSectionID =
  | "general"
  | "discovery"
  | "links"
  | "layout"
  | "source"
  | "assets"
  | "notes"
  | "danger";

export type PropertiesSection = { id: PropertiesSectionID; label: string };

export const PROPERTIES_SECTIONS: PropertiesSection[] = [
  { id: "general", label: "General" },
  { id: "discovery", label: "Discovery" },
  { id: "links", label: "Links & Integrations" },
  { id: "layout", label: "Page Layout" },
  { id: "source", label: "Source" },
  { id: "assets", label: "Asset Defaults" },
  { id: "notes", label: "Notes" },
  { id: "danger", label: "Danger Zone" },
];

/** Top-level form keys that live outside the General section, for the nav's error markers. */
const FIELD_SECTIONS: Record<string, PropertiesSectionID> = {
  contentArea: "discovery",
  tags: "discovery",
  cidDescriptors: "discovery",
  associatedOrgs: "discovery",
  projectURL: "links",
  adaptURL: "links",
  projectModules: "layout",
  defaultChatNotification: "layout",
  author: "source",
  authorEmail: "source",
  doi: "source",
  isbns: "source",
  sourceOriginalPublicationDate: "source",
  sourceHarvestDate: "source",
  sourceLastModifiedDate: "source",
  sourceLanguage: "source",
  license: "source",
  defaultFileLicense: "assets",
  defaultPrimaryAuthor: "assets",
  notes: "notes",
};

export const sectionForField = (field: string): PropertiesSectionID =>
  FIELD_SECTIONS[field] ?? "general";
