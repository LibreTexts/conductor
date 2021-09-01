//
// LibreTexts Conductor
// filterReducer.js
//

/* Filters */
const filtersInitialState = {
    adaptCatalog: {
        mode: 'visual',
        itemsPerPage: 6,
        activePage: 1 // not used as URL param
    },
    commonsCatalog: {
        mode: 'visual',
        itemsPerPage: 6,
        activePage: 1, // not used as URL param,
        search: '',
        sort: 'title',
        library: '',
        subject: '',
        author: '',
        license: '',
        affiliation: '',
        course: '',
    },
    collections: {
        mode: 'visual'
    },
    collectionView: {
        mode: 'visual',
        itemsPerPage: 6,
        activePage: 1, // not used as URL param
        sort: 'title',
        library: '',
        subject: '',
        author: '',
        license: ''
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
        case 'SET_ADAPT_ITEMS':
            return {
                ...state,
                adaptCatalog: {
                    ...state.adaptCatalog,
                    itemsPerPage: action.payload
                }
            }
        case 'SET_ADAPT_PAGE':
            return {
                ...state,
                adaptCatalog: {
                    ...state.adaptCatalog,
                    activePage: action.payload
                }
            }
        case 'SET_COLLECTIONS_MODE':
            return {
                ...state,
                collections: {
                    ...state.collections,
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
        case 'SET_CATALOG_ITEMS':
            return {
                ...state,
                commonsCatalog: {
                    ...state.commonsCatalog,
                    itemsPerPage: action.payload
                }
            }
        case 'SET_CATALOG_PAGE':
            return {
                ...state,
                commonsCatalog: {
                    ...state.commonsCatalog,
                    activePage: action.payload
                }
            }
        case 'SET_CATALOG_SEARCH':
            return {
                ...state,
                commonsCatalog: {
                    ...state.commonsCatalog,
                    search: action.payload
                }
            }
        case 'SET_CATALOG_SORT':
            return {
                ...state,
                commonsCatalog: {
                    ...state.commonsCatalog,
                    sort: action.payload
                }
            }
        case 'SET_CATALOG_LIBRARY':
            return {
                ...state,
                commonsCatalog: {
                    ...state.commonsCatalog,
                    library: action.payload
                }
            }
        case 'SET_CATALOG_SUBJECT':
            return {
                ...state,
                commonsCatalog: {
                    ...state.commonsCatalog,
                    subject: action.payload
                }
            }
        case 'SET_CATALOG_AUTHOR':
            return {
                ...state,
                commonsCatalog: {
                    ...state.commonsCatalog,
                    author: action.payload
                }
            }
        case 'SET_CATALOG_LICENSE':
            return {
                ...state,
                commonsCatalog: {
                    ...state.commonsCatalog,
                    license: action.payload
                }
            }
        case 'SET_CATALOG_AFFIL':
            return {
                ...state,
                commonsCatalog: {
                    ...state.commonsCatalog,
                    affiliation: action.payload
                }
            }
        case 'SET_CATALOG_COURSE':
            return {
                ...state,
                commonsCatalog: {
                    ...state.commonsCatalog,
                    course: action.payload
                }
            }
        case 'SET_COLLECT_MODE':
            return {
                ...state,
                collectionView: {
                    ...state.collectionView,
                    mode: action.payload
                }
            }
        case 'SET_COLLECT_ITEMS':
            return {
                ...state,
                collectionView: {
                    ...state.collectionView,
                    itemsPerPage: action.payload
                }
            }
        case 'SET_COLLECT_PAGE':
            return {
                ...state,
                collectionView: {
                    ...state.collectionView,
                    activePage: action.payload
                }
            }
        case 'SET_COLLECT_SORT':
            return {
                ...state,
                collectionView: {
                    ...state.collectionView,
                    sort: action.payload
                }
            }
        case 'SET_COLLECT_LIBRARY':
            return {
                ...state,
                collectionView: {
                    ...state.collectionView,
                    library: action.payload
                }
            }
        case 'SET_COLLECT_SUBJECT':
            return {
                ...state,
                collectionView: {
                    ...state.collectionView,
                    subject: action.payload
                }
            }
        case 'SET_COLLECT_AUTHOR':
            return {
                ...state,
                collectionView: {
                    ...state.collectionView,
                    author: action.payload
                }
            }
        case 'SET_COLLECT_LICENSE':
            return {
                ...state,
                collectionView: {
                    ...state.collectionView,
                    license: action.payload
                }
            }
        default:
            return state;
    }
}
