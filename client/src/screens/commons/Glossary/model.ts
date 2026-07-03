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
};
