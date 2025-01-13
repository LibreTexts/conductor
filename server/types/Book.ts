export type BookSortOption = "random" | "author" | "title";
export type TableOfContents = {
  id: string;
  title: string;
  url: string;
  children: TableOfContents[];
};
