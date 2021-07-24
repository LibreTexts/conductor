const { isEmptyString } = require('./util/helpers.js');

const threePartDateStringValidator = (value) => {
    if (!isEmptyString(value)) { // validate
        const rawDate = String(value).split('-');
        const date = new Date(rawDate[2], rawDate[0]-1, rawDate[1]);
        if (!(date instanceof Date && !isNaN(date))) {
            return false;
        } else {
            return true;
        }
    } else {
        return false;
    }
};

module.exports = {
    threePartDateStringValidator
};
