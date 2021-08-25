import { combineReducers } from 'redux';

import userReducer from './userReducer.js';
import orgReducer from './orgReducer.js';
import filterReducer from './filterReducer.js';
import errorReducer from './errorReducer.js';

const rootReducer = combineReducers({
    user: userReducer,
    org: orgReducer,
    filters: filterReducer,
    error: errorReducer
});

export default rootReducer;
