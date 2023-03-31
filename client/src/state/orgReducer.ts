//
// LibreTexts Conductor
// orgReducer.js
//

import { Organization } from "../types";
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
    collectionsDisplayLabel: 'Collections'
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
