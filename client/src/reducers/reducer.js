import { combineReducers } from 'redux';

import userReducer from './userReducer.js';
import orgReducer from './orgReducer.js';
import filterReducer from './filterReducer.js';

const rootReducer = combineReducers({
    user: userReducer,
    org: orgReducer,
    filters: filterReducer
});

export default rootReducer;
