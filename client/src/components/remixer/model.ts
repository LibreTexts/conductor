import { Book, MasterCatalogV2Response } from "../../types";

export type Library = "bio" | "biz" | "chem" | "dev" | "eng" | "espanol" | "geo" | "human" | "k12" | "math" | "med" | "phys" | "socialsci" | "stats" | "workforce";
export const libraries: Library[] = ["bio", "biz", "chem", "dev", "eng", "espanol", "geo", "human", "k12", "math", "med", "phys", "socialsci", "stats", "workforce"];
export type PublishJobStatus = "idle" | "pending" | "running" | "success" | "error";

export const libraryTitles: Record<Library, string> = {
  bio: "Biology",
  biz: "Business",
  chem: "Chemistry",
  dev: "Development",
  eng: "Engineering",
  espanol: "Español",
  geo: "Geosciences",
  human: "Humanities",
  k12: "K-12 Education",
  math: "Mathematics",
  med: "Medicine",
  phys: "Physics",
  socialsci: "Social Sciences",
  stats: "Statistics",
  workforce: "Workforce",
};


export type NumberingType = "numeric" | "alphabetic" | "alphabetic_lower" | "roman" | "roman_lower" | "none";

export interface PathLevelFormat {
    level: number;
    excludeParent?: boolean;
    delimiter?: string;
    prefix: string;
    start: number;
    type: NumberingType;
}

export interface RemixerSubPage {
    "@id": string;
    "@title": string;
    "@href": string;
    "@subpages":boolean;
    "article": "article"|"topic-category"|"topic-guide";
    "parentID"?: string;
    "namespace": string;
    "title": string;
    "uri.ui": string;
    originalPathNumber?: string[];
    pathNumber?: string[];
    numberedPath?: string;
    formattedPath?: string;
    formattedPathOverride?: boolean;
    isDeleted?: boolean;
    isImported?: boolean;
    isRenamed?: boolean;
    isPlacementChanged?: boolean;
    addedItem?: boolean;
    movedItem?: boolean;
    renamedItem?: boolean;
    deletedItem?: boolean;
    sourceID?: string;
}

export type RemixerLibrary = Partial<Record<Library, RemixerSubPage[]>>;

export interface RemixerData {
    projectID?: string;
    title?: string;
    liberCoverID?: string;
    libreLibrary?: string;
    currentBook?: RemixerSubPage[];
    library?: RemixerLibrary;
    libraries?: string[];
    selectedLibrary?: Library;
    autoNumbering?: boolean;
    catalogBook?: Book[];
    masterCatelog ?: MasterCatalogV2Response;
}

export const remixerDataInit:RemixerData = { autoNumbering: true } as RemixerData;

export interface RemixerUiState {
    catalogListOpen: boolean;
    publishPanelOpen: boolean;
    pathNameFormatOpen: boolean;
    editPanelOpen: boolean;
    selectedBookNodeId?: string;
    pathNameFormatDepth: number;
    pathLevelFormats?: PathLevelFormat[];
    copyModeState?: string;
}



export type CopyMode="Transclude"|"Fork"| "Full";
export interface CopyModeState {
    title: string;
    value: CopyMode;
    isAdminOnly: boolean;
}

export const copyModeStates: CopyModeState[] = [
    { title: "Copy-Transclude (Recommended)", value: "Transclude", isAdminOnly: false },
    { title: "Copy-Fork", value: "Fork", isAdminOnly: false },
    { title: "Copy-Full (Admin Only)", value: "Full", isAdminOnly: true },
];

export const defaultCopyModeState: CopyModeState = copyModeStates[0];

export interface PrefixOption {
  key: string;
  text: string;
  value: string;
}

export const DEFAULT_PREFIX_OPTIONS: PrefixOption[] = [
  { key: "none", text: "None", value: "" },
  { key: "chapter", text: "Chapter", value: "Chapter " },
  { key: "unit", text: "Unit", value: "Unit " },
  { key: "section", text: "Section", value: "Section " },
];

export const DELIMITER_OPTIONS = [
  { key: "dot", text: ".", value: "." },
  { key: "dash", text: "-", value: "-" },
  { key: "slash", text: "/", value: "/" },
  { key: "space", text: "space", value: " " },
];

export const NUMBERING_TYPE_OPTIONS = [
  { key: "numeric", text: "Numeric (1, 2, 3)", value: "numeric" },
  { key: "alphabetic", text: "Upper Alphabetic (A, B, C)", value: "alphabetic" },
  { key: "alphabetic_lower", text: "Lower Alphabetic (a, b, c)", value: "alphabetic_lower" },
  { key: "roman", text: "Upper Roman (I, II, III)", value: "roman" },
  { key: "roman_lower", text: "Lower Roman (i, ii, iii)", value: "roman_lower" },
  { key: "none", text: "No numbering", value: "none" },
];

export const remixerUiStateInit: RemixerUiState = {
    catalogListOpen: false,
    publishPanelOpen: false,
    pathNameFormatOpen: false,
    editPanelOpen: false,
    selectedBookNodeId: undefined,
    pathNameFormatDepth: 0,
    pathLevelFormats: [],
    copyModeState: copyModeStates[0].value,
};

export interface GetRemixerDisplayTitleOptions {
  isBookTree: boolean;
  autoNumbering: boolean;
  pathLevelFormats?: PathLevelFormat[];
  /** Nearest-ancestor override resolution for descendants (book tree). */
  remixerPathLookup?: {
    nodesById: Map<string, RemixerSubPage>;
    ordinalPathById: Map<string, string[]>;
  };
}