import { createStore } from 'redux';
import rootReducer from './reducer.js';

const store = createStore(rootReducer);

// Infer the `RootState` types from the store itself
export type RootState = ReturnType<typeof store.getState>

export type AppDispatch = typeof store.dispatch

export default store;
