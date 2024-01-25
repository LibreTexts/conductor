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
  defaultProjectLead: string;
  addToLibreGridList: boolean;
  catalogMatchingTags?: string[];
  supportTicketNotifiers?: string[];
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
>;
