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
  showCommonsMetrics: boolean;
  collectionsDisplayLabel?: string;
  collectionsMessage?: string;
  primaryColor?: string;
  footerColor?: string;
  defaultProjectLead: string;
  addToLibreGridList: boolean;
  catalogMatchingTags: string[];
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
  | "showCommonsMetrics"
  | "collectionsDisplayLabel"
  | "collectionsMessage"
  | "primaryColor"
  | "footerColor"
>;
