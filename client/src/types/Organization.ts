export type Organization = {
    orgID: string,
    name: string,
    domain: string,
    shortName?: string,
    abbreviation?: string,
    aliases?: string[],
    coverPhoto?: string,
    largeLogo: string,
    mediumLogo: string,
    smallLogo: string,
    aboutLink: string,
    commonsHeader: string,
    commonsMessage: string,
    mainColor: string,
    defaultProjectLead: string,
    addToLibreGridList: boolean,
    catalogMatchingTags: string[]
}