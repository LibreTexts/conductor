/*
id: '',
title: '',
author: '',
institution: '',
thumbnail: '',
library: '',
subject: '',
license: '',
summary: "",
preview: '',
contents: [],
links: {
    online: '',
    pdf: '',
    buy: '',
    zip: '',
    files: '',
    lms: ''
}
*/

const addtlDemoBooks = [
    {
        id: '1',
        title: 'Introduction to Stoichiometry',
        author: 'Delmar Larsen',
        institution: '',
        thumbnail: '/thumbnails/general-chemistry.jpg',
        library: 'chemistry',
        subject: 'chem_general_chemistry',
        license: 'cc-by-nc-sa',
        summary: "",
        preview: '',
        contents: [],
        links: {
            online: '',
            pdf: '',
            buy: '',
            zip: '',
            files: '',
            lms: ''
        }
    },
    {
        id: '2',
        title: 'The Basics of React.js',
        author: 'Ethan Turner',
        institution: '',
        thumbnail: '/thumbnails/react.png',
        library: 'engineering',
        subject: 'eng_computer_science',
        license: 'cc-by-nc-sa',
        summary: "",
        preview: '',
        contents: [],
        links: {
            online: '',
            pdf: '',
            buy: '',
            zip: '',
            files: '',
            lms: ''
        }
    },
    {
        id: '3',
        title: 'Building an H5P Library',
        author: 'Henry Agnew',
        institution: '',
        thumbnail: '/thumbnails/h5p.png',
        library: 'engineering',
        subject: 'eng_computer_science',
        license: 'cc-by-nc-sa',
        summary: "",
        preview: '',
        contents: [],
        links: {
            online: '',
            pdf: '',
            buy: '',
            zip: '',
            files: '',
            lms: ''
        }
    },
    {
        id: '4',
        title: 'Fostering Accessible Knowledge at the University Level',
        author: 'Dorte Madsen',
        institution: '',
        thumbnail: '/thumbnails/knowledge.jpg',
        library: 'workforce',
        subject: 'work_arts_audio_visual_technology_and_communications',
        license: 'cc-by-nc-sa',
        summary: "",
        preview: '',
        contents: [],
        links: {
            online: '',
            pdf: '',
            buy: '',
            zip: '',
            files: '',
            lms: ''
        }
    },
    {
        id: '5',
        title: 'Developing Coordinated Curriculums — A Case Study',
        author: 'Josh Halpern',
        institution: '',
        thumbnail: '/thumbnails/curriculum.jpg',
        library: 'social_science',
        subject: 'soc_scieducation_and_professional_development',
        license: 'cc-by-nc-sa',
        summary: "",
        preview: '',
        contents: [],
        links: {
            online: '',
            pdf: '',
            buy: '',
            zip: '',
            files: '',
            lms: ''
        }
    }
];


const libreDemoBooks = [
    {
        id: '1',
        title: 'ENGR 260: Circuits and Devices',
        author: 'Ramki Kalyanaraman',
        institution: 'Cañada College',
        thumbnail: 'https://eng.libretexts.org/@api/deki/pages/52863/files/=mindtouch.page%2523thumbnail',
        library: 'engineering',
        subject: 'eng_electrical_engineering',
        license: '',
        summary: "",
        preview: 'https://batch.libretexts.org/print/Letter/Finished/eng-52863/Preview.pdf?view=true',
        contents: [],
        links: {
            online: 'https://eng.libretexts.org/Courses/Canada_College/Circuits_and_Devices',
            pdf: 'https://batch.libretexts.org/print/Letter/Finished/eng-52863/Full.pdf',
            buy: 'https://libretexts.org/bookstore/single.html?eng-52863',
            zip: 'https://batch.libretexts.org/print/Letter/Finished/eng-52863/Individual.zip',
            files: 'https://batch.libretexts.org/print/Letter/Finished/eng-52863/Publication.zip',
            lms: 'https://batch.libretexts.org/print/Letter/Finished/eng-52863/LibreText.imscc'
        }
    },
    {
        id: '2',
        title: 'Research Methods in Psychology',
        author: 'Carrie Cuttler et al.',
        institution: 'Washington State University',
        thumbnail: 'https://socialsci.libretexts.org/@api/deki/pages/16081/files/=mindtouch.page%2523thumbnail',
        library: 'social_science',
        subject: 'soc_scipsychology',
        license: 'cc-by-nc-sa',
        summary: "This text provides an overview of research design strategies used in psychological research. It covers the basic descriptive statistics and concepts within inferential statistics that are necessary for appreciation and comprehension of research findings. The course presents the student with the fundamentals of research that all psychology majors should know. Emphasis is placed on the critical evaluation of psychological research.",
        preview: 'https://batch.libretexts.org/print/Letter/Finished/socialsci-16081/Preview.pdf?view=true',
        contents: [],
        links: {
            online: 'https://socialsci.libretexts.org/Courses/CSU_Fresno/Book%3A_Research_Methods_in_Psychology_(Cuttler_et_al.)',
            pdf: 'https://batch.libretexts.org/print/Letter/Finished/socialsci-16081/Full.pdf',
            buy: 'https://libretexts.org/bookstore/single.html?socialsci-16081',
            zip: 'https://batch.libretexts.org/print/Letter/Finished/socialsci-16081/Individual.zip',
            files: 'https://batch.libretexts.org/print/Letter/Finished/socialsci-16081/Publication.zip',
            lms: 'https://batch.libretexts.org/print/Letter/Finished/socialsci-16081/LibreText.imscc'
        }
    },
    {
        id: '3',
        title: 'CISC 302: Computer Familiarization',
        author: 'Marjorie Duffy',
        institution: 'Consumnes River College',
        thumbnail: 'https://workforce.libretexts.org/@api/deki/pages/14582/files/=mindtouch.page%2523thumbnail',
        library: 'workforce',
        subject: 'work_information_technology',
        license: '',
        summary: "This test provides general knowledge on how computers work, computer terminology and the impact of computers on society and the work environment. Beginning level hands-on instruction using an operating system, word processing software, spreadsheet software, database software, email and the Internet are emphasized.",
        preview: 'https://batch.libretexts.org/print/Letter/Finished/workforce-14582/Preview.pdf?view=true',
        contents: [],
        links: {
            online: 'https://workforce.libretexts.org/Courses/Cosumnes_River_College/CISC_302%3A_Computer_Familiarization_(Duffy)',
            pdf: 'https://batch.libretexts.org/print/Letter/Finished/workforce-14582/Full.pdf',
            buy: 'https://libretexts.org/bookstore/single.html?workforce-14582',
            zip: 'https://batch.libretexts.org/print/Letter/Finished/workforce-14582/Individual.zip',
            files: 'https://batch.libretexts.org/print/Letter/Finished/workforce-14582/Publication.zip',
            lms: 'https://batch.libretexts.org/print/Letter/Finished/workforce-14582/LibreText.imscc'
        }
    },
    {
        id: '4',
        title: 'Analytical Chemistry 2.1',
        author: 'David Harvey',
        institution: 'DePauw University',
        thumbnail: 'https://chem.libretexts.org/@api/deki/pages/220642/files/=mindtouch.page%2523thumbnail',
        library: 'chemistry',
        subject: 'chem_analytical_chemistry',
        license: 'cc-by-nc-sa',
        summary: "The introductory course in analytical chemistry is the ideal place in the undergraduate chemistry curriculum for exploring topics such as experimental design, sampling, calibration strategies, standardization, optimization, statistics, and the validation of experimental results. Analytical methods come and go, but best practices for designing and validating analytical methods are universal.",
        preview: 'https://batch.libretexts.org/print/Letter/Finished/chem-220642/Preview.pdf?view=true',
        contents: [],
        links: {
            online: 'https://chem.libretexts.org/Courses/BethuneCookman_University/B-CU%3A_CH-345_Quantitative_Analysis/Book%3A_Analytical_Chemistry_2.1_(Harvey)',
            pdf: 'https://batch.libretexts.org/print/Letter/Finished/chem-220642/Full.pdf',
            buy: 'https://libretexts.org/bookstore/single.html?chem-220642',
            zip: 'https://batch.libretexts.org/print/Letter/Finished/chem-220642/Individual.zip',
            files: 'https://batch.libretexts.org/print/Letter/Finished/chem-220642/Publication.zip',
            lms: 'https://batch.libretexts.org/print/Letter/Finished/chem-220642/LibreText.imscc'
        }
    },
    {
        id: '5',
        title: 'MAT 310 Bridge to Advanced Mathematics',
        author: 'Richard Hammack',
        institution: 'Virginia Commonwealth University',
        thumbnail: 'https://math.libretexts.org/@api/deki/pages/33670/files/=mindtouch.page%2523thumbnail',
        library: 'mathematics',
        subject: 'math_mathematical_logic_and_proofs',
        license: 'cc-by-nc-nd',
        summary: "This book will initiate you into an esoteric world. You will learn and apply the methods of thought that mathematicians use to verify theorems, explore mathematical truth and create new mathematical theories. This will prepare you for advanced mathematics courses, for you will be better able to understand proofs, write your own proofs and think critically and inquisitively about mathematics.",
        preview: 'https://batch.libretexts.org/print/Letter/Finished/math-33670/Preview.pdf?view=true',
        contents: [],
        links: {
            online: 'https://math.libretexts.org/Courses/Borough_of_Manhattan_Community_College/MAT_310_Bridge_to_Advanced_Mathematics',
            pdf: 'https://batch.libretexts.org/print/Letter/Finished/math-33670/Full.pdf',
            buy: 'https://libretexts.org/bookstore/single.html?math-33670',
            zip: 'https://batch.libretexts.org/print/Letter/Finished/math-33670/Individual.zip',
            files: 'https://batch.libretexts.org/print/Letter/Finished/math-33670/Publication.zip',
            lms: 'https://batch.libretexts.org/print/Letter/Finished/math-33670/LibreText.imscc'
        }
    }
];


const ucdDemoBooks = [
    {
        id: '1',
        title: 'Introduction to Quantum Mechanics',
        author: 'Delmar Larsen',
        institution: 'University of California, Davis',
        thumbnail: '/thumbnails/general.png',
        library: 'chemistry',
        subject: 'chem_physical_and_theoretical_chemistry',
        license: 'cc-by-nc-sa',
        summary: "This text focuses on introducing students to the postulates and general principles of quantum mechanics. Application to harmonic oscillator, rigid rotor, one-electron and many-electron atoms, and homo- and hetero-nuclear diatomic molecules are discussed including variational method and time-independent perturbation theory approximations.",
        preview: 'https://batch.libretexts.org/print/Letter/Finished/chem-198631/Preview.pdf?view=true',
        contents: [
            {
                title: "Front Matter",
                pages: ["TitlePage", "InfoPage", "Table of Contents"]
            },
            {
                title: "1: The Dawn of the Quantum Theory",
                pages: ["1.1: Blackbody Radiation Cannot Be Explained Classically", "1.2: Quantum Hypothesis used for Blackbody Radiation Law"]
            }
        ],
        links: {
            online: 'https://chem.libretexts.org/Courses/BethuneCookman_University/B-CU%3ACH-331_Physical_Chemistry_I/CH-331_Text/CH-331_Text',
            pdf: 'https://batch.libretexts.org/print/Letter/Finished/chem-198631/Full.pdf',
            buy: 'https://libretexts.org/bookstore/single.html?chem-198631',
            zip: 'https://batch.libretexts.org/print/Letter/Finished/chem-198631/Individual.zip',
            files: 'https://batch.libretexts.org/print/Letter/Finished/chem-198631/Publication.zip',
            lms: 'https://batch.libretexts.org/print/Letter/Finished/chem-198631/LibreText.imscc'
        }
    },
    {
        id: '2',
        title: 'Chem 124A: Fundamentals of Inorganic Chemistry',
        author: '',
        institution: 'University of California, Davis',
        thumbnail: '/thumbnails/124a.png',
        library: 'chemistry',
        subject: 'chem_inorganic_chemistry',
        license: '',
        summary: "This texts address the fundamentals of inorganic chemistry with emphases on symmetry, molecular geometry and structure, molecular orbital theory of bonding (polyatomic molecules and transition metals), solid state chemistry, energetics and spectroscopy of inorganic compounds.",
        preview: 'https://batch.libretexts.org/print/Letter/Finished/chem-262746/Preview.pdf?view=true',
        links: {
            online: 'https://chem.libretexts.org/Courses/University_of_California_Davis/UCD_Chem_124A%3A_Fundamentals_of_Inorganic_Chemistry',
            pdf: 'https://batch.libretexts.org/print/Letter/Finished/chem-262746/Full.pdf',
            buy: 'https://libretexts.org/bookstore/single.html?chem-262746',
            zip: 'https://batch.libretexts.org/print/Letter/Finished/chem-262746/Individual.zip',
            files: 'https://batch.libretexts.org/print/Letter/Finished/chem-262746/Publication.zip',
            lms: 'https://batch.libretexts.org/print/Letter/Finished/chem-262746/LibreText.imscc'
        }
    },
    {
        id: '3',
        title: 'UC Davis: Chem 2BH Honors General Chemistry II',
        author: 'Delmar Larsen',
        institution: 'University of California, Davis',
        thumbnail: '/thumbnails/general.png',
        library: 'chemistry',
        subject: 'chem_general_chemistry',
        license: '',
        summary: "This text is designed for the second-semester general chemistry course honors course and has been developed to meet the scope and sequence of most general chemistry courses. The text materials covers three primary units: Thermodynamics, Physical Equilibria and Chemical Equilibria with seven Chapters. The organization was careful formulated to introduce enthalpy, entropy, and Gibbs energy, and then use these skills to understand physical and chemical equilibria.",
        preview: 'https://batch.libretexts.org/print/Letter/Finished/chem-2737/Preview.pdf?view=true',
        links: {
            online: 'https://chem.libretexts.org/Courses/University_of_California_Davis/UCD_Chem_002BH/Text',
            pdf: 'https://batch.libretexts.org/print/Letter/Finished/chem-2737/Full.pdf',
            buy: 'https://libretexts.org/bookstore/single.html?chem-2737',
            zip: 'https://batch.libretexts.org/print/Letter/Finished/chem-2737/Individual.zip',
            files: 'https://batch.libretexts.org/print/Letter/Finished/chem-2737/Publication.zip',
            lms: 'https://batch.libretexts.org/print/Letter/Finished/chem-2737/LibreText.imscc'
        }
    },
    {
        id: '4',
        title: 'Introduction to Quantum Mechanics',
        author: 'Kristie Koski',
        institution: 'University of California, Davis',
        thumbnail: '/thumbnails/general.png',
        library: 'chemistry',
        subject: 'chem_physical_and_theoretical_chemistry',
        summary: '',
        license: '',
        preview: 'https://batch.libretexts.org/print/Letter/Finished/chem-2392/Preview.pdf?view=true',
        links: {
            online: 'https://chem.libretexts.org/Courses/University_of_California_Davis/UCD_Chem_110A%3A_Physical_Chemistry__I/UCD_Chem_110A%3A_Physical_Chemistry_I_(Koski)/Text',
            pdf: 'https://batch.libretexts.org/print/Letter/Finished/chem-2392/Full.pdf',
            buy: 'https://libretexts.org/bookstore/single.html?chem-2392',
            zip: 'https://batch.libretexts.org/print/Letter/Finished/chem-2392/Individual.zip',
            files: 'https://batch.libretexts.org/print/Letter/Finished/chem-2392/Publication.zip',
            lms: 'https://batch.libretexts.org/print/Letter/Finished/chem-2392/LibreText.imscc'
        }
    },
    {
        id: '5',
        title: 'CHE 1150: Instrumental Analysis Lab Manual',
        author: '',
        institution: 'University of California, Davis',
        thumbnail: '/thumbnails/1150.png',
        library: 'chemistry',
        subject: 'chem_analytical_chemistry',
        license: '',
        summary: 'This manual is the culmination of the efforts of many individuals. While some of the experiments are "classics", and appear in various forms in many Quantitative Analysis textbooks and laboratory manuals, much effort was expended to ensure that the experiments work well here at UC Davis and thus each experiment has been extensively tailored for our laboratory program. We view this manual as one of continual modification, and often improvements arise from comments and criticisms.',
        preview: 'https://batch.libretexts.org/print/Letter/Finished/chem-136260/Preview.pdf?view=true',
        links: {
            online: 'https://chem.libretexts.org/Courses/University_of_California_Davis/UCD_Chem_115_Lab_Manual',
            pdf: 'https://batch.libretexts.org/print/Letter/Finished/chem-136260/Full.pdf',
            buy: 'https://libretexts.org/bookstore/single.html?chem-136260',
            zip: 'https://batch.libretexts.org/print/Letter/Finished/chem-136260/Individual.zip',
            files: 'https://batch.libretexts.org/print/Letter/Finished/chem-136260/Publication.zip',
            lms: 'https://batch.libretexts.org/print/Letter/Finished/chem-136260/LibreText.imscc'
        }
    },
    {
        id: '6',
        title: 'CHEM 110A: Introduction to Quantum Mechanics',
        author: 'Delmar Larsen',
        institution: 'University of California, Davis',
        thumbnail: '/thumbnails/general.png',
        library: 'chemistry',
        subject: 'chem_physical_and_theoretical_chemistry',
        license: 'cc-by-nc-sa',
        summary: "This text focuses on introducing students to the postulates and general principles of quantum mechanics. Application to harmonic oscillator, rigid rotor, one-electron and many-electron atoms, and homo- and hetero-nuclear diatomic molecules are discussed including variational method and time-independent perturbation theory approximations.",
        preview: 'https://batch.libretexts.org/print/Letter/Finished/chem-92335/Preview.pdf?view=true',
        links: {
            online: 'https://chem.libretexts.org/Courses/University_of_California_Davis/UCD_Chem_110A%3A_Physical_Chemistry__I/UCD_Chem_110A%3A_Physical_Chemistry_I_(Larsen)/Text',
            pdf: 'https://batch.libretexts.org/print/Letter/Finished/chem-92335/Full.pdf',
            buy: 'https://libretexts.org/bookstore/single.html?chem-92335',
            zip: 'https://batch.libretexts.org/print/Letter/Finished/chem-92335/Individual.zip',
            files: 'https://batch.libretexts.org/print/Letter/Finished/chem-92335/Publication.zip',
            lms: 'https://batch.libretexts.org/print/Letter/Finished/chem-92335/LibreText.imscc'
        }
    },
    {
        id: '7',
        title: 'UC Davis Chem 110B Physical Chemistry II',
        author: 'Delmar Larsen',
        institution: 'University of California, Davis',
        thumbnail: '/thumbnails/general.png',
        library: 'chemistry',
        subject: 'chem_physical_and_theoretical_chemistry',
        license: '',
        summary: '',
        preview: 'https://batch.libretexts.org/print/Letter/Finished/chem-2393/Preview.pdf?view=true',
        links: {
            online: 'https://chem.libretexts.org/Courses/University_of_California_Davis/UCD_Chem_110B%3A_Physical_Chemistry_II/Text',
            pdf: 'https://batch.libretexts.org/print/Letter/Finished/chem-2393/Full.pdf',
            buy: 'https://libretexts.org/bookstore/single.html?chem-2393',
            zip: 'https://batch.libretexts.org/print/Letter/Finished/chem-2393/Individual.zip',
            files: 'https://batch.libretexts.org/print/Letter/Finished/chem-2393/Publication.zip',
            lms: 'https://batch.libretexts.org/print/Letter/Finished/chem-2393/LibreText.imscc'
        }
    }
];

const canadaDemoBooks = [
    {
        id: '1',
        title: 'ENGR 260: Circuits and Devices',
        author: 'Ramki Kalyanaraman',
        institution: 'Cañada College',
        thumbnail: 'https://eng.libretexts.org/@api/deki/pages/52863/files/=mindtouch.page%2523thumbnail',
        library: 'engineering',
        subject: 'eng_electrical_engineering',
        license: '',
        summary: "",
        preview: 'https://batch.libretexts.org/print/Letter/Finished/eng-52863/Preview.pdf?view=true',
        contents: [],
        links: {
            online: 'https://eng.libretexts.org/Courses/Canada_College/Circuits_and_Devices',
            pdf: 'https://batch.libretexts.org/print/Letter/Finished/eng-52863/Full.pdf',
            buy: 'https://libretexts.org/bookstore/single.html?eng-52863',
            zip: 'https://batch.libretexts.org/print/Letter/Finished/eng-52863/Individual.zip',
            files: 'https://batch.libretexts.org/print/Letter/Finished/eng-52863/Publication.zip',
            lms: 'https://batch.libretexts.org/print/Letter/Finished/eng-52863/LibreText.imscc'
        }
    },
    {
        id: '2',
        title: 'Chem 410 Health Chemistry',
        author: 'Nick DeMello',
        institution: 'Cañada College',
        thumbnail: '/thumbnails/health_chemistry.png',
        library: 'chemistry',
        subject: 'chem_introductory_conceptual_and_gob_biochemistry',
        license: '',
        summary: "Covering many of the topics of introductory chemistry and adding more in organic and biochemistry, health chemistry is often described as GOB (general, organic & bio) chemistry. With a targeted and rapid-paced presentation designed to support students with goals in nursing, PT or PA programs, this one semester 4 unit class is a unique option for students in the health care industry.",
        preview: 'https://batch.libretexts.org/print/Letter/Finished/chem-161579/Preview.pdf?view=true',
        contents: [],
        links: {
            online: 'https://chem.libretexts.org/Courses/can/health',
            pdf: 'https://batch.libretexts.org/print/Letter/Finished/chem-161579/Full.pdf',
            buy: 'https://libretexts.org/bookstore/single.html?chem-161579',
            zip: 'https://batch.libretexts.org/print/Letter/Finished/chem-161579/Individual.zip',
            files: 'https://batch.libretexts.org/print/Letter/Finished/chem-161579/Publication.zip',
            lms: 'https://batch.libretexts.org/print/Letter/Finished/chem-161579/LibreText.imscc'
        }
    },
    {
        id: '3',
        title: 'Chem 192: Introductory Chemistry',
        author: 'Nick DeMello',
        institution: 'Cañada College',
        thumbnail: '/thumbnails/chem192.png',
        library: 'chemistry',
        subject: 'chem_introductory_conceptual_and_gob_biochemistry',
        license: '',
        summary: "Introductory or elementary chemistry is a solid introduction to the foundation topics of chemistry. It meets general education requirements for science, is transferable to UC and CSU systems, and meets the requirements for RadTech and other certifications. This one semester 4 unit class with lab is a good general purpose introduction to chemistry.",
        preview: 'https://batch.libretexts.org/print/Letter/Finished/chem-161800/Preview.pdf?view=true',
        contents: [],
        links: {
            online: 'https://chem.libretexts.org/Courses/can/intro',
            pdf: 'https://batch.libretexts.org/print/Letter/Finished/chem-161800/Full.pdf',
            buy: 'https://libretexts.org/bookstore/single.html?chem-161800',
            zip: 'https://batch.libretexts.org/print/Letter/Finished/chem-161800/Individual.zip',
            files: 'https://batch.libretexts.org/print/Letter/Finished/chem-161800/Publication.zip',
            lms: 'https://batch.libretexts.org/print/Letter/Finished/chem-161800/LibreText.imscc'
        }
    },
    {
        id: '4',
        title: 'Cañada College Organic Chemistry',
        author: 'Nick DeMello',
        institution: 'Cañada College',
        thumbnail: '/thumbnails/cc_chemistry.png',
        library: 'chemistry',
        subject: 'chem_organic_chemistry',
        license: '',
        summary: "The element carbon has unique properties making it a foundation for very large and wonderfully intricate molecules.  The properties and function of the more than 50 million unique substances the human race understands, most of which are organic compounds, can be understood by exploring the composition, connectivity, shape, and sense of carbon-based molecules.  Organic Chemistry is a challenging and valuable discussion transferable to both the UC and CSU systems.",
        preview: 'https://batch.libretexts.org/print/Letter/Finished/chem-161984/Preview.pdf?view=true',
        contents: [],
        links: {
            online: 'https://chem.libretexts.org/Courses/can/org',
            pdf: 'https://batch.libretexts.org/print/Letter/Finished/chem-161984/Full.pdf',
            buy: 'https://libretexts.org/bookstore/single.html?chem-161984',
            zip: 'https://batch.libretexts.org/print/Letter/Finished/chem-161984/Individual.zip',
            files: 'https://batch.libretexts.org/print/Letter/Finished/chem-161984/Publication.zip',
            lms: 'https://batch.libretexts.org/print/Letter/Finished/chem-161984/LibreText.imscc'
        }
    }
];

const ucdCollections = [
    {
        id: 'general-chemistry',
        thumbnail: '/thumbnails/general-chemistry.jpg',
        title: 'General Chemistry',
        size: '12 books'
    },
    {
        id: 'intro-psychology',
        thumbnail: '/thumbnails/intro-psychology.jpg',
        title: 'Introductory Psychology',
        size: '8 books'
    },
    {
        id: 'medicine',
        thumbnail: '/thumbnails/medicine.jpg',
        title: 'Medicine',
        size: '5 books'
    }
];

const canadaCollections = [
    {
        id: 'general-chemistry',
        thumbnail: '/thumbnails/general-chemistry.jpg',
        title: 'General Chemistry',
        size: '2 books'
    }
];

const getDemoBooks = (orgID) => {
    switch (orgID) {
        case 'ucdavis':
            return ucdDemoBooks;
        case 'canadacollege':
            return canadaDemoBooks;
        case 'libretexts':
            return libreDemoBooks;
        default:
            return [];
    }
};

const getDemoCollections = (orgID) => {
    switch (orgID) {
        case 'ucdavis':
            return ucdCollections;
        case 'canadacollege':
            return canadaCollections;
        default:
            return [];
    }
};

const getInstName = (inst) => {
    switch (inst) {
        case 'ucdavis':
            return "University of California, Davis";
        case 'canadacollege':
            return "Cañada College";
        default:
            return "LibreTexts";
    }
};

module.exports = {
    getDemoBooks,
    getDemoCollections,
    getInstName
}
