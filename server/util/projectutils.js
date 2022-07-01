//
// LibreTexts Conductor
// projectutils.js
//
import axios from 'axios';
import { stringContainsOneOfSubstring, getProductionURL } from './helpers.js';
import { libraryNameKeys } from './librariesmap.js';

export const projectClassifications = [
    'harvesting',
    'curation',
    'construction',
    'technology',
    'librefest',
    'coursereport',
    'adoptionrequest',
    'miscellaneous'
];

export const constrRoadmapSteps = [
    '1', '2', '3', '4', '5a', '5b', '5c', '6', '7', '8', '9', '10', '11', '12'
];

export const textUseOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'primary', text: 'As the primary textbook', value: 'primary' },
    { key: 'supplement', text: 'As supplementary material', value: 'supplement' },
    { key: 'remix', text: 'As part of a remix that I am creating for my class', value: 'remix' },
    { key: 'other', text: 'Other (please explain in comments)', value: 'other' },
];


/**
 * Validates that a given classification string is one of the
 * pre-defined, acceptable classifications.
 * @param {String} classification  - the classification string to test
 * @returns {Boolean} true if valid classification, false otherwise
 */
export const validateProjectClassification = (classification) => {
    return projectClassifications.includes(classification);
};


/**
 * Validates that a given Construction Roadmap step name is one of the
 * pre-defined, acceptable step names.
 * @param {String} step  - the step name to test
 * @returns {Boolean} true if valid step, false otherwise.
 */
export const validateRoadmapStep = (step) => {
    return constrRoadmapSteps.includes(step);
};


/**
 * Retrieves the UI-ready representation of a Text Use option.
 * @param {String} use - The internal Text Use identifier.
 * @returns {String} The UI-ready representation, or an empty string if not found.
 */
export const getTextUse = (use) => {
    if (use !== '') {
        let foundUse = textUseOptions.find((item) => {
            return item.value === use;
        });
        if (foundUse !== undefined) return foundUse.text;
    } else {
        return '';
    }
};


/**
 * Retrieves basic information about a LibreText and its location via the LibreTexts API.
 * @param {String} url - The LibreTexts url to retrieve information about.
 * @returns {Object} An object with information about the LibreText (lib, id, shelf, campus).
 */
export const getLibreTextInformation = (url) => {
    let textInfo = {
        lib: '',
        id: '',
        shelf: '',
        campus: ''
    }
    return new Promise((resolve, reject) => {
        if (typeof (url) === 'string') {
            let subdomainSearch = stringContainsOneOfSubstring(url, libraryNameKeys, true);
            if (subdomainSearch.hasOwnProperty('substr') && subdomainSearch.substr !== '') {
                textInfo.lib = subdomainSearch.substr;
                let libNames = libraryNameKeys.join('|');
                let libreURLRegex = new RegExp(`(http(s)?:\/\/)?(${libNames}).libretexts.org\/`, 'i');
                let path = url.replace(libreURLRegex, '');
                resolve(axios.put('https://api.libretexts.org/endpoint/info', {
                    subdomain: subdomainSearch.substr,
                    path: path,
                    dreamformat: 'json'
                }, { headers: { 'Origin': getProductionURL() } }));
            }
        }
        reject();
    }).then((axiosRes) => {
        if (axiosRes.data) {
            let apiData = axiosRes.data;
            if (apiData.hasOwnProperty('@id') && typeof (apiData['@id']) === 'string') {
                textInfo.id = apiData['@id'];
            }
            if (apiData.hasOwnProperty('path') && typeof (apiData.path) === 'object') {
                if (apiData.path.hasOwnProperty('#text') && typeof (apiData.path['#text'] === 'string')) {
                    let foundPath = apiData.path['#text'];
                    let bookshelfRegex = new RegExp('Bookshelves\/', 'i');
                    let courseRegex = new RegExp('Courses\/', 'i');
                    if (bookshelfRegex.test(foundPath)) {
                        let intraShelfPath = foundPath.replace(bookshelfRegex, '');
                        let pathComponents = intraShelfPath.split('/');
                        if (Array.isArray(pathComponents) && pathComponents.length > 1) {
                            let mainShelf = decodeURIComponent(pathComponents[0]).replace(/_/g, ' ');
                            if (pathComponents.length > 2) {
                                mainShelf += `/${decodeURIComponent(pathComponents[1]).replace(/_/g, ' ')}`;
                            }
                            textInfo.shelf = mainShelf;
                        }
                    } else if (courseRegex.test(foundPath)) {
                        let intraShelfPath = foundPath.replace(courseRegex, '');
                        let pathComponents = intraShelfPath.split('/');
                        if (Array.isArray(pathComponents) && pathComponents.length > 0) {
                            textInfo.campus = decodeURIComponent(pathComponents[0]).replace(/_/g, ' ');
                        }
                    }
                }
            }

        }
        return textInfo;
    }).catch((_err) => {
        return textInfo;
    });
};
