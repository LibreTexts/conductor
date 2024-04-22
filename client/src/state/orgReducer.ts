//
// LibreTexts Conductor
// orgReducer.js
//

import { CommonsModuleSettings, Organization } from "../types";
import { AnyAction } from "redux";

const orgInitialState = <Organization>{
    orgID: '',
    name: '',
    shortName: '',
    abbreviation: '',
    coverPhoto: '',
    largeLogo: '',
    mediumLogo: '',
    smallLogo: '',
    aboutLink: '',
    commonsHeader: '',
    commonsMessage: '',
    collectionsDisplayLabel: 'Collections',
    primaryColor: '',
    footerColor: '',
    customOrgList: [] as string[],
    commonsModules: {
      books: {
        enabled: true,
        order: 1
      },
      assets: {
        enabled: true,
        order: 2
      },
      projects: {
        enabled: true,
        order: 3
      }
    } as CommonsModuleSettings,
    showCollections: true,
    assetFilterExclusions: [] as string[]
};

export default function orgReducer(
  state = orgInitialState,
  action: AnyAction
): Organization {
  switch (action.type) {
    case "SET_ORG_INFO":
      return action.payload;
    case "CLEAR_ORG_INFO":
      return orgInitialState;
    default:
      return state;
  }
}
