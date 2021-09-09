//
// LibreTexts Conductor
// LibreAPIHelpers.js
//

const axios = require('axios');
const mtAxios = axios.create({});


const getSubdomainAndPageFromBookID = (bookID) => {
    if (bookID) {
        const splitID = String(bookID).split('-');
        if (splitID.length > 1) {
            return [splitID[0], splitID[1]];
        }
    }
    return '';
}

const parseURL = (url) => {
    if (url.includes('?')) //strips any query parameters
        url = url.split('?')[0];
    if (url && url.match(/https?:\/\/.*?\.libretexts\.org/)) {
        return [url.match(/(?<=https?:\/\/).*?(?=\.)/)[0], url.match(/(?<=https?:\/\/.*?\/).*/)[0]]
    }
    else {
        return [];
    }
};

export const libreAPIFetch = (bookID) => {
    const [subdomain, pageID] = getSubdomainAndPageFromBookID(bookID);
    const pageNum = parseInt(pageID);
    if (!isNaN(pageNum)) {
        console.log(subdomain);
        console.log(pageNum);
        let pageURL = `https://${subdomain}.libretexts.org/@api/deki/pages/${pageNum}?dream.out.format=json`;
        console.log(pageURL);
        mtAxios.get(pageURL).then((res) => {
            console.log(res.data);
            return {};
        }).catch((err) => {
            console.log(err);
            return {};
        });
    }
};
