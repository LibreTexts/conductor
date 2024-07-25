export type CommonsModule = "books" | "assets" | "projects" | "authors";

export type CommonsModuleConfig = {
  enabled: boolean;
  order: number;
}

export type CommonsModuleSettings = {
  books: CommonsModuleConfig;
  assets: CommonsModuleConfig;
  projects: CommonsModuleConfig;
  authors: CommonsModuleConfig;
}

export type Organization = {
  orgID: string;
  name: string;
  domain: string;
  shortName?: string;
  abbreviation?: string;
  aliases?: string[];
  coverPhoto?: string;
  largeLogo: string;
  mediumLogo: string;
  smallLogo: string;
  aboutLink: string;
  commonsHeader: string;
  commonsMessage: string;
  collectionsDisplayLabel?: string;
  collectionsMessage?: string;
  primaryColor?: string;
  footerColor?: string;
  videoLengthLimit: number;
  defaultProjectLead: string;
  addToLibreGridList: boolean;
  catalogMatchingTags?: string[];
  supportTicketNotifiers?: string[];
  FEAT_AssetTagsManager?: boolean;
  FEAT_PedagogyProjectTags?: boolean;
  customOrgList?: string[];
  commonsModules?: CommonsModuleSettings;
  showCollections?: boolean;
  assetFilterExclusions?: string[];
};

export type CampusSettingsOpts = Pick<
  Organization,
  | "coverPhoto"
  | "largeLogo"
  | "mediumLogo"
  | "smallLogo"
  | "aboutLink"
  | "commonsHeader"
  | "commonsMessage"
  | "collectionsDisplayLabel"
  | "collectionsMessage"
  | "primaryColor"
  | "footerColor"
  | "addToLibreGridList"
  | "catalogMatchingTags"
  | "customOrgList"
  | "commonsModules"
  | "showCollections"
  | "assetFilterExclusions"
>;
