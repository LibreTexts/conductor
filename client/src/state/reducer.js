import userReducer from './userReducer.js';
import orgReducer from './orgReducer';
import filterReducer from './filterReducer.js';
import errorReducer from './errorReducer.js';
import { checkCampusAdmin, checkSuperAdmin } from '../components/util/HelperFunctions.js';

const rootReducer = (state = {}, action) => {
  let actionDerived = action;
  /* High-level permissions check requires multiple state parts, so pass it down */
  if (action.type === 'SET_USER_INFO') {
    actionDerived.payload = {
      ...action.payload,
      isCampusAdmin: checkCampusAdmin(action.payload?.roles, state.org?.orgID),
      isSuperAdmin: checkSuperAdmin(action.payload?.roles),
    };
  }
  return {
    user: userReducer(state.user, actionDerived),
    org: orgReducer(state.org, actionDerived),
    filters: filterReducer(state.filters, actionDerived),
    error: errorReducer(state.error, actionDerived),
  }
};

export default rootReducer;
