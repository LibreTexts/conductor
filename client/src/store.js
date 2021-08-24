import { createStore } from 'redux';
import rootReducer from './reducers/reducer.js';

const store = createStore(rootReducer);

export default store;
