//
// LibreTexts Conductor
// userReducer.js
//

/* Utils */
import Cookies from "js-cookie";
import { User } from "../types";
import { AnyAction } from "redux";
/* User */
const userInitialState = <User>{
  uuid: "",
  authType: "",
  firstName: "",
  lastName: "",
  email: "",
  avatar: "/favicon-96x96.png",
  roles: [
    {
      org: "",
      role: "",
    },
  ],
  pinnedProjects: undefined,
  authorizedApps: undefined,
  instructorProfile: undefined,
  isAuthenticated: false,
  isCampusAdmin: false,
  isSuperAdmin: false,
  verifiedInstructor: false,
};

export default function userReducer(
  state = userInitialState,
  action: AnyAction
) {
  switch (action.type) {
    case "SET_AUTH":
      return {
        ...state,
        isAuthenticated: true,
      };
    case "CHECK_AUTH":
      if (Cookies.get("conductor_access_v2") !== undefined) {
        return {
          ...state,
          isAuthenticated: true,
        };
      } else {
        return state;
      }
    case "CLEAR_AUTH":
      return {
        ...state,
        isAuthenticated: false,
      };
    case "SET_USER_NAME":
      return {
        ...state,
        firstName: action.payload.firstName,
        lastName: action.payload.lastName,
      };
    case "SET_USER_INFO":
      return {
        ...state,
        uuid: action.payload.uuid,
        authType: action.payload.authType,
        firstName: action.payload.firstName,
        lastName: action.payload.lastName,
        roles: action.payload.roles,
        avatar: action.payload.avatar,
        email: action.payload.email,
        isCampusAdmin: action.payload.isCampusAdmin,
        isSuperAdmin: action.payload.isSuperAdmin,
        verifiedInstructor: action.payload.verifiedInstructor,
      };
    case "CLEAR_USER_INFO":
      return userInitialState;
    default:
      return state;
  }
}
