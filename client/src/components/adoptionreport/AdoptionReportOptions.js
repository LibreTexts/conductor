//
// AdoptionReportOptions.js
//

/*
    Resource Access Options Map:
    0 = Online                  = 'online'
    1 = Printed Book            = 'print'
    2 = Downloaded PDF          = 'pdf'
    3 = Via LMS                 = 'lms'
    4 = LibreTexts in a Box     = 'librebox'
*/

import { eachMonthOfInterval } from 'date-fns';

const iAmOptions = [
    { key: 'empty',         text: 'Choose...',  value: '' },
    { key: 'student',       text: 'Student',    value: 'student' },
    { key: 'instructor',    text: 'Instructor', value: 'instructor' }
];

const libreNetOptions = [
    { key: 'empty',             text: 'Choose...',                              value: '' },
    { key: 'asccc',             text: 'ASCCC',                                  value: 'ASCCC' },
    { key: 'calstate',          text: 'CalState University',                    value: 'CalState University' },
    { key: 'contracosta',       text: 'Contra Costa Community College',         value: 'Contra Costa Community College' },
    { key: 'harrisburgarea',    text: 'Harrisburg Area Community College',      value: 'Harrisburg Area Community College' },
    { key: 'hopecollege',       text: 'Hope College',                           value: 'Hope College' },
    { key: 'kansasstate',       text: 'Kansas State University',                value: 'Kansas State University' },
    { key: 'losrios',           text: 'Los Rios Community College',             value: 'Los Rios Community College' },
    { key: 'princegeorges',     text: "Prince George's Community College",      value: "Prince George's Community College" },
    { key: 'ualr',              text: 'University of Arkansas at Little Rock',  value: 'University of Arkansas at Little Rock' },
    { key: 'ucd',               text: 'University of California, Davis',        value: 'University of California, Davis' },
    { key: 'uoh',               text: 'University of Hawaii',                   value: 'University of Hawaii' },
    { key: 'other',             text: 'Other',                                  value: 'Other' }
];

const studentUseOptions = [
    {
        key: 'empty',
        text: 'Choose...',
        value: ''
    }, { 
        key: 'primary',
        text: 'As the primary textbook',
        value: 'Primary Textbook'
    }, { 
        key: 'supplement-suggested',
        text: 'Supplementary resource (suggested by instructor)',
        value: 'Supplementary (suggested by instructor)'
    }, { 
        key: 'supplement-notsuggested',
        text: 'Supplementary resource (not suggested by instructor)',
        value: 'Supplementary (not suggested by instructor)' 
    }
];

const instructionalTerms = {
  fq: { textPrefix: 'Fall Quarter', months: [9, 10, 11, 12] },
  fs: { textPrefix: 'Fall Semester', months: [8, 9, 10, 11, 12] },
  wq: { textPrefix: 'Winter Quarter', months: [1, 2, 3, 4] },
  sq: { textPrefix: 'Spring Quarter', months: [3, 4, 5, 6] },
  ss: { textPrefix: 'Spring Semester', months: [1, 2, 3, 4, 5, 6] },
  sum: { textPrefix: 'Summer', months: [6, 7, 8] },
};

/**
 * Generates a list of potential instructional terms in which an instructor may have used a text.
 * The generated range is centered around the current date and bounded by one year in the past
 * and up to six months in the future.
 *
 * @returns {object[]} An array of objects describing instructional terms in the
 *  key/text/value shape.
 */
function getInstructionTermOptions() {
  const now = new Date();
  const twoYearsAgo = new Date().setFullYear(now.getFullYear() - 2);
  const sixMonthsFuture = new Date().setMonth(now.getMonth() + 6);

  const datesISO = new Set();
  [
    ...eachMonthOfInterval({ start: twoYearsAgo, end: now }),
    ...eachMonthOfInterval({ start: now, end: sixMonthsFuture }),
  ].forEach((date) => datesISO.add(date.toISOString()));

  const allMonths = [];
  datesISO.forEach((dateString) => allMonths.push(new Date(dateString)));

  const allOptions = [];
  const termKeys = new Set();

  const getYearAsTwoDigit = (fullYear) => {
    if (Number.isNaN(fullYear)) {
      return '';
    }
    return fullYear.toString().slice(-2);
  };

  const addTermsByMonth = (month) => {
    const monthNum = month.getMonth() + 1;
    Object.entries(instructionalTerms).forEach(([termPrefix, term]) => {
      if (term.months.includes(monthNum)) {
        const year = month.getFullYear();
        const key = `${termPrefix}${getYearAsTwoDigit(year)}`;
        if (!termKeys.has(key)) {
          termKeys.add(key);
          allOptions.push({
            year,
            key: key,
            text: `${term.textPrefix} ${year}`,
            value: key,
            startMonth: term.months[0],
          });
        }
      }
    });
  };

  allMonths.forEach((month) => addTermsByMonth(month));
  allOptions.sort((a, b) => (a.year - b.year) || (a.startMonth - b.startMonth)).map((a) => {
    const term = a;
    delete term.year;
    delete term.startMonth;
    return term;
  });

  return [
    { key: 'empty', text: 'Choose...', value: '' },
    ...allOptions
  ];
}

/**
 * Retrieves the UI-ready text for a provided Instructional Term identifier.
 *
 * @param {string} term - The Instructional Term shortened identifier.
 * @returns {string} The UI-ready Term name, or 'Unknown Term'. 
 */
function getTermTaughtText(term) {
  if (typeof (term) === 'string' && term.length > 0 && term.length < 6) {
    const termKey = term.slice(0, -2);
    const termSuffix = term.slice(-2);
    const termObj = instructionalTerms[termKey];
    if (termObj) {
      return `${termObj.textPrefix} 20${termSuffix}`;
    }
  }
  return 'Unknown Term';
}

/**
 * Retrieves UI-ready text for a provided response to the LibreNet consortium membership question.
 *
 * @param {string} response - The user's response identifier.
 * @returns {string} The UI-ready user response.
 */
function getLibreNetConsortiumText(response) {
  switch (response) {
    case 'yes':
      return 'Yes';
    case 'no':
      return 'No';
    case 'dk':
      return `Don't know`;
    default:
      return 'Unknown';
  }
}

/**
 * Builds a UI-ready, comma separated list of resource access methods given an
 * array of internal identifiers.
 * @param {String[]} accessOptions - Array of internal access method identifiers.
 * @returns {String} A UI-ready, comma-separated list of access methods, or an empty string.
 */
const buildAccessMethodsList = (accessOptions) => {
    let accessString = "";
    const appendToAccessString = (text, idx) => {
        if (idx === 0) {
            accessString = accessString.concat(text);
        } else {
            accessString = accessString.concat(", " + text);
        }
    };
    accessOptions.forEach((item, idx) => {
        switch (item) {
            case 'online':
                appendToAccessString("Online", idx);
                break;
            case 'print':
                appendToAccessString("Printed Book", idx);
                break;
            case 'pdf':
                appendToAccessString("Downloaded PDF", idx);
                break;
            case 'lms':
                appendToAccessString("Via LMS", idx);
                break;
            case 'librebox':
                appendToAccessString("LibreTexts in a Box", idx);
                break;
            default:
                break; // Silence React warning
        }
    });
    return accessString;
};


export {
    iAmOptions,
    libreNetOptions,
    studentUseOptions,
    getInstructionTermOptions,
    getTermTaughtText,
    getLibreNetConsortiumText,
    buildAccessMethodsList
}
