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
};
