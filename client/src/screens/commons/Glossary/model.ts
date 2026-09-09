export type GlossaryPageUsage = {
  pageID: string;
  addedBy: string;
  createdAt: string;
};

export type GlossaryEntry = {
  usageID: string;
  term: string;
  termID: string;
  definition: string;
  pages: GlossaryPageUsage[];
  imageUrl?: string;
  aliases?: string[];
  author?: string;
  link?: string;
  source?: string;
  imageSource?: string;
  imageAuthor?: string;
  imageLicense?: string;
  altText?: string;
  caption?: string;
  /** Render the term itself in italics (e.g. species names, foreign words). */
  italic?: boolean;
};

export type GlossaryConfigMode = "PAGE" | "CHAPTER" | "BACKMATTER";

export type GlossaryConfigGroup = {
  groupID: string;
  pageIds: string[];
  /** The page this group's combined glossary is displayed on. */
  targetPageId: string;
};

export type GlossaryConfig = {
  mode: GlossaryConfigMode;
  glossaryPageId?: string;
  groups: GlossaryConfigGroup[];
};

export type GlossaryConfigMode = "PAGE" | "CHAPTER" | "BACKEND";

export type GlossaryConfigGroup = {
  groupID: string;
  pageIds: string[];
  /** The page this group's combined glossary is displayed on. */
  targetPageId: string;
};

export type GlossaryConfig = {
  mode: GlossaryConfigMode;
  glossaryPageId?: string;
  groups: GlossaryConfigGroup[];
};
