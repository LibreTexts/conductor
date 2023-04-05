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
  mainColor: string;
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
  | "collectionsDisplayLabel"
  | "collectionsMessage"
>;
