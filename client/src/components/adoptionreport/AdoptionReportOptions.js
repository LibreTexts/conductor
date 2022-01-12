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

const iAmOptions = [
    { key: 'empty', text: 'Choose...', value: '' },
    { key: 'student', text: 'Student', value: 'student' },
    { key: 'instructor', text: 'Instructor', value: 'instructor' }
];

const libreNetOptions = [
    { key: 'empty', text: 'Choose...', value: '' },
    { key: 'asccc', text: 'ASCCC', value: 'ASCCC' },
    { key: 'calstate', text: 'CalState University', value: 'CalState University' },
    { key: 'contracosta', text: 'Contra Costa Community College', value: 'Contra Costa Community College' },
    { key: 'harrisburgarea', text: 'Harrisburg Area Community College', value: 'Harrisburg Area Community College' },
    { key: 'hopecollege', text: 'Hope College', value: 'Hope College' },
    { key: 'kansasstate', text: 'Kansas State University', value: 'Kansas State University' },
    { key: 'losrios', text: 'Los Rios Community College', value: 'Los Rios Community College' },
    { key: 'princegeorges', text: "Prince George's Community College", value: "Prince George's Community College" },
    { key: 'ualr', text: 'University of Arkansas at Little Rock', value: 'University of Arkansas at Little Rock' },
    { key: 'ucd', text: 'University of California, Davis', value: 'University of California, Davis' },
    { key: 'uoh', text: 'University of Hawaii', value: 'University of Hawaii' },
    { key: 'other', text: 'Other', value: 'Other' }
];

const studentUseOptions = [
    { key: 'empty', text: 'Choose...', value: '' },
    { key: 'primary', text: 'As the primary textbook', value: 'Primary Textbook' },
    { key: 'supplement-suggested', text: 'Supplementary resource (suggested by instructor)', value: 'Supplementary (suggested by instructor)' },
    { key: 'supplement-notsuggested', text: 'Supplementary resource (not suggested by instructor)', value: 'Supplementary (not suggested by instructor)' }
];

const instrTaughtOptions = [
    { key: 'empty', text: 'Choose...', value: '' },
    { key: 'fq19', text: 'Fall Quarter 2019', value: 'fq19' },
    { key: 'fs19', text: 'Fall Semester 2019', value: 'fs19' },
    { key: 'wq20', text: 'Winter Quarter 2020', value: 'wq20' },
    { key: 'sq20', text: 'Spring Quarter 2020', value: 'sq20' },
    { key: 'ss20', text: 'Spring Semester 2020', value: 'ss20' },
    { key: 'sum20', text: 'Summer 2020', value: 'sum20' },
    { key: 'fq20', text: 'Fall Quarter 2020', value: 'fq20' },
    { key: 'fs20', text: 'Fall Semester 2020', value: 'fs20' },
    { key: 'wq21', text: 'Winter Quarter 2021', value: 'wq21' },
    { key: 'sq21', text: 'Spring Quarter 2021', value: 'sq21' },
    { key: 'ss21', text: 'Spring Semester 2021', value: 'ss21' },
    { key: 'sum21', text: 'Summer 2021', value: 'sum21' }
];

const getTermTaught = (term) => {
    var foundTerm = instrTaughtOptions.find((element) => {
        if (element.value === term) {
            return element;
        }
        return null;
    });
    if (foundTerm !== undefined) {
        return foundTerm.text;
    } else {
        return "Unknown Term";
    }
};

const buildAccessMethodsList = (accessOptions) => {
    var accessString = "";
    const appendToAccessString = (text, idx) => {
        if (idx === 0) {
            accessString = accessString.concat(text);
        } else {
            accessString = accessString.concat(", " + text);
        }
    };
    accessOptions.forEach((item, idx) => {
        switch(item) {
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
}

export {
    iAmOptions,
    libreNetOptions,
    studentUseOptions,
    instrTaughtOptions,
    getTermTaught,
    buildAccessMethodsList
}
