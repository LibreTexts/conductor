//
// LibreTexts Conductor
// filterReducer.js
//

/* Filters */
const filtersInitialState = {
    adaptCatalog: {
        mode: 'visual'
    },
    commonsCatalog: {
        mode: 'visual'
    }
};

export default function filterReducer(state = filtersInitialState, action) {
    switch(action.type) {
        case 'SET_ADAPT_MODE':
            return {
                ...state,
                adaptCatalog: {
                    ...state.adaptCatalog,
                    mode: action.payload
                }
            }
        case 'SET_CATALOG_MODE':
            return {
                ...state,
                commonsCatalog: {
                    ...state.commonsCatalog,
                    mode: action.payload
                }
            }
        default:
            return state;
    }
}
