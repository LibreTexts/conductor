export interface RemixerSubPage {
    "@id": string;
    "@title": string;
    "@href": string;
    "@subpages": boolean;
    article: string;
    namespace: string;
    title: string;
    "uri.ui": string;
    parentID?: string;
    formattedPath?: string;
  }

export type RemixerPageStatus =
  | "unchanged"
  | "modified"
  | "new"
  | "imported"
  | "deleted";