const libraries = [
    { key: 'bio',       text: 'Biology',        value: 'bio' },
    { key: 'biz',       text: 'Business',       value: 'biz' },
    { key: 'chem',      text: 'Chemistry',      value: 'chem' },
    { key: 'dev',       text: 'Development',    value: 'dev' },
    { key: 'eng',       text: 'Engineering',    value: 'eng' },
    { key: 'espanol',   text: 'Español',        value: 'espanol' },
    { key: 'geo',       text: 'Geosciences',    value: 'geo' },
    { key: 'human',     text: 'Humanities',     value: 'human' },
    { key: 'k12',       text: 'K12 Education',  value: 'k12'},
    { key: 'math',      text: 'Mathematics',    value: 'math' },
    { key: 'med',       text: 'Medicine',       value: 'med' },
    { key: 'phys',      text: 'Physics',        value: 'phys' },
    { key: 'socialsci', text: 'Social Science', value: 'socialsci' },
    { key: 'stats',     text: 'Statistics',     value: 'stats' },
    { key: 'workforce', text: 'Workforce',      value: 'workforce' }
];

export const librariesOptions:string[] = libraries.map(library => library.value);
export const libraryKeys :string=librariesOptions.join('|');