//
// LibreTexts Conductor
// librariesmap.js
//

const libraries = [
    {
        key: 'bio',
        name: 'Biology',
        thumbnail: '/libicons/bio.png',
        link: 'https://bio.libretexts.org',
        shelves: [
            {
            	name: 'Biotechnology',
            	link: 'https://bio.libretexts.org/Bookshelves/Biotechnology'
            },
            {
            	name: 'Biochemistry',
            	link: 'https://bio.libretexts.org/Bookshelves/Biochemistry'
            },
            {
            	name: 'Botany',
            	link: 'https://bio.libretexts.org/Bookshelves/Botany'
            },
            {
            	name: 'Cell and Molecular',
            	link: 'https://bio.libretexts.org/Bookshelves/Cell_and_Molecular_Biology'
            },
            {
            	name: 'Computational Biology',
            	link: 'https://bio.libretexts.org/Bookshelves/Computational_Biology'
            },
            {
            	name: 'Ecology',
            	link: 'https://bio.libretexts.org/Bookshelves/Ecology'
            },
            {
            	name: 'Evolutionary & Developmental',
            	link: 'https://bio.libretexts.org/Bookshelves/Evolutionary_Developmental_Biology'
            },
            {
            	name: 'Genetics',
            	link: 'https://bio.libretexts.org/Bookshelves/Genetics'
            },
            {
            	name: 'Human Biology',
            	link: 'https://bio.libretexts.org/Bookshelves/Human_Biology'
            },
            {
                name: 'Introductory and General',
                link: 'https://bio.libretexts.org/Bookshelves/Introductory_and_General_Biology'
            },
            {
                name: 'Microbiology',
                link: 'https://bio.libretexts.org/Bookshelves/Microbiology'
            }
        ]
    },
    {
        key: 'biz',
        name: 'Business',
        thumbnail: '/libicons/biz.png',
        link: 'https://biz.libretexts.org',
        shelves: [
            {
            	name: 'Accounting',
            	link: 'https://biz.libretexts.org/Bookshelves/Accounting'
            },
            {
            	name: 'Business',
            	link: 'https://biz.libretexts.org/Bookshelves/Business'
            },
            {
            	name: 'Finance',
            	link: 'https://biz.libretexts.org/Bookshelves/Finance'
            },
            {
            	name: 'Law',
            	link: 'https://biz.libretexts.org/Bookshelves/Law'
            },
            {
            	name: 'Management',
            	link: 'https://biz.libretexts.org/Bookshelves/Management'
            },
            {
            	name: 'Marketing',
            	link: 'https://biz.libretexts.org/Bookshelves/Marketing'
            }
        ]
    },
    {
        key: 'chem',
        name: 'Chemistry',
        thumbnail: '/libicons/chem.png',
        link: 'https://chem.libretexts.org',
        shelves: [
            {
            	name: 'Analytical',
            	link: 'https://chem.libretexts.org/Bookshelves/Analytical_Chemistry'
            },
            {
            	name: 'Biological',
            	link: 'https://chem.libretexts.org/Bookshelves/Biological_Chemistry'
            },
            {
            	name: 'Introductory, Conceptual, and GOB',
            	link: 'https://chem.libretexts.org/Bookshelves/Introductory_Chemistry'
            },
            {
            	name: 'Environmental',
            	link: 'https://chem.libretexts.org/Bookshelves/Environmental_Chemistry'
            },
            {
            	name: 'General',
            	link: 'https://chem.libretexts.org/Bookshelves/General_Chemistry'
            },
            {
            	name: 'Inorganic',
            	link: 'https://chem.libretexts.org/Bookshelves/Inorganic_Chemistry'
            },
            {
            	name: 'Organic',
            	link: 'https://chem.libretexts.org/Bookshelves/Organic_Chemistry'
            },
            {
            	name: 'Physical and Theoretical',
            	link: 'https://chem.libretexts.org/Bookshelves/Physical_and_Theoretical_Chemistry_Textbook_Maps'
            }
        ]
    },
    {
        key: 'eng',
        name: 'Engineering',
        thumbnail: '/libicons/eng.png',
        link: 'https://eng.libretexts.org',
        shelves: [
            {
            	name: 'Aerospace',
            	link: 'https://eng.libretexts.org/Bookshelves/Aerospace_Engineering'
            },
            {
            	name: 'Biological',
            	link: 'https://eng.libretexts.org/Bookshelves/Biological_Engineering'
            },
            {
            	name: 'Chemical',
            	link: 'https://eng.libretexts.org/Bookshelves/Chemical_Engineering'
            },
            {
            	name: 'Civil',
            	link: 'https://eng.libretexts.org/Bookshelves/Civil_Engineering'
            },
            {
            	name: 'Computer Science',
            	link: 'https://eng.libretexts.org/Bookshelves/Computer_Science'
            },
            {
            	name: 'Electrical',
            	link: 'https://eng.libretexts.org/Bookshelves/Electrical_Engineering'
            },
            {
            	name: 'Environmental (Sustainability and Conservation)',
            	link: 'https://eng.libretexts.org/Bookshelves/Environmental_Engineering_(Sustainability_and_Conservation)'
            },
            {
            	name: 'Industrial & Systems',
            	link: 'https://eng.libretexts.org/Bookshelves/Industrial_and_Systems_Engineering'
            },
            {
            	name: 'Introductory',
            	link: 'https://eng.libretexts.org/Bookshelves/Introduction_to_Engineering'
            },
            {
            	name: 'Materials Science',
            	link: 'https://eng.libretexts.org/Bookshelves/Materials_Science'
            },
            {
            	name: 'Mechanical',
            	link: 'https://eng.libretexts.org/Bookshelves/Mechanical_Engineering'
            }
        ]
    },
    {
        key: 'espanol',
        name: 'Español',
        thumbnail: '/libicons/espanol.png',
        link: 'https://espanol.libretexts.org',
        shelves: [
            {
                name: 'Ciencias Sociales',
                link: 'https://espanol.libretexts.org/Ciencias_Sociales'
            },
            {
                name: 'Estadística',
                link: 'https://espanol.libretexts.org/Estadistica',
            },
            {
                name: 'Geociencias',
                link: 'https://espanol.libretexts.org/Geociencias'
            },
            {
                name: 'Ingenieria',
                link: 'https://espanol.libretexts.org/Ingenieria'
            },
            {
                name: 'Matemáticas',
                link: 'https://espanol.libretexts.org/Matematicas'
            },
            {
                name: 'Medicina',
                link: 'https://espanol.libretexts.org/Medicina'
            },
            {
                name: 'Negocio',
                link: 'https://espanol.libretexts.org/Negocio'
            },
            {
                name: 'Química',
                link: 'https://espanol.libretexts.org/Quimica'
            },
            {
                name: 'Vocacional',
                link: 'https://espanol.libretexts.org/Vocacional'
            }
        ]
    },
    {
        key: 'geo',
        name: 'Geosciences',
        thumbnail: '/libicons/geo.png',
        link: 'https://geo.libretexts.org',
        shelves: [
            {
            	name: 'Geography',
            	link: 'https://geo.libretexts.org/Bookshelves/Geography_(Physical)'
            },
            {
            	name: 'Geology',
            	link: 'https://geo.libretexts.org/Bookshelves/Geology'
            },
            {
            	name: 'Meteorology & Climate Science',
            	link: 'https://geo.libretexts.org/Bookshelves/Meteorology_and_Climate_Science'
            },
            {
            	name: 'Oceanography',
            	link: 'https://geo.libretexts.org/Bookshelves/Oceanography'
            },
            {
            	name: 'Sedimentology',
            	link: 'https://geo.libretexts.org/Bookshelves/Sedimentology'
            },
            {
            	name: 'Seismology',
            	link: 'https://geo.libretexts.org/Bookshelves/Seismology'
            },
            {
            	name: 'Soil Science',
            	link: 'https://geo.libretexts.org/Bookshelves/Soil_Science'
            }
        ]
    },
    {
        key: 'human',
        name: 'Humanities',
        thumbnail: '/libicons/human.png',
        link: 'https://human.libretexts.org',
        shelves: [
            {
            	name: 'Art',
            	link: 'https://human.libretexts.org/Bookshelves/Art'
            },
            {
            	name: 'Composition',
            	link: 'https://human.libretexts.org/Bookshelves/Composition'
            },
            {
            	name: 'Gender Studies',
            	link: 'https://human.libretexts.org/Bookshelves/Gender_Studies'
            },
            {
            	name: 'History',
            	link: 'https://human.libretexts.org/Bookshelves/History'
            },
            {
            	name: 'Humanities',
            	link: 'https://human.libretexts.org/Bookshelves/Humanities'
            },
            {
            	name: 'Languages',
            	link: 'https://human.libretexts.org/Bookshelves/Languages'
            },
            {
            	name: 'Literature and Literacy',
            	link: 'https://human.libretexts.org/Bookshelves/Literature_and_Literacy'
            },
            {
            	name: 'Music',
            	link: 'https://human.libretexts.org/Bookshelves/Music'
            },
            {
            	name: 'Philosophy',
            	link: 'https://human.libretexts.org/Bookshelves/Philosophy'
            },
            {
            	name: 'Religious Studies',
            	link: 'https://human.libretexts.org/Bookshelves/Religious_Studies'
            },
            {
            	name: 'Research & Information Literacy',
            	link: 'https://human.libretexts.org/Bookshelves/Research_and_Information_Literacy'
            },
            {
            	name: 'Theater & Film',
            	link: 'https://human.libretexts.org/Bookshelves/Theater_and_Film'
            }
        ]
    },
    {
        key: 'k12',
        name: 'K12 Education',
        thumbnail: '/libicons/k12.png',
        link: 'https://k12.libretexts.org',
        shelves: [
            {
            	name: 'Composition',
            	link: 'https://k12.libretexts.org/Bookshelves/Commonsense_Composition'
            },
            {
            	name: 'Economics',
            	link: 'https://k12.libretexts.org/Bookshelves/Economics'
            },
            {
            	name: 'Geography',
            	link: 'https://k12.libretexts.org/Bookshelves/Geography'
            },
            {
            	name: 'Health',
            	link: 'https://k12.libretexts.org/Bookshelves/Health_-_Skills_For_A_Healthy_Me'
            },
            {
            	name: 'Human Biology',
            	link: 'https://k12.libretexts.org/Bookshelves/Human_Biology_-_Digestion_and_Nutrition'
            },
            {
            	name: 'Journalism',
            	link: 'https://k12.libretexts.org/Bookshelves/Journalism_101'
            },
            {
            	name: 'Mathematics',
            	link: 'https://k12.libretexts.org/Bookshelves/Mathematics'
            },
            {
            	name: 'Philosophy',
            	link: 'https://k12.libretexts.org/Bookshelves/Philosophy'
            },
            {
            	name: 'Photography',
            	link: 'https://k12.libretexts.org/Bookshelves/Photography'
            },
            {
            	name: 'Science and Technology',
            	link: 'https://k12.libretexts.org/Bookshelves/Science_and_Technology'
            },
            {
            	name: 'Sociology',
            	link: 'https://k12.libretexts.org/Bookshelves/Sociology'
            },
            {
            	name: 'Spelling',
            	link: 'https://k12.libretexts.org/Bookshelves/Spelling'
            },
            {
            	name: 'United States Government',
            	link: 'https://k12.libretexts.org/Bookshelves/United_States_Government'
            }
        ]
    },
    {
        key: 'math',
        name: 'Mathematics',
        thumbnail: '/libicons/math.png',
        link: 'https://math.libretexts.org',
        shelves: [
            {
            	name: 'Abstract & Geometric Algebra',
            	link: 'https://math.libretexts.org/Bookshelves/Abstract_and_Geometric_Algebra'
            },
            {
            	name: 'Algebra',
            	link: 'https://math.libretexts.org/Bookshelves/Algebra'
            },
            {
            	name: 'Analysis',
            	link: 'https://math.libretexts.org/Bookshelves/Analysis'
            },
            {
            	name: 'Applied Mathematics',
            	link: 'https://math.libretexts.org/Bookshelves/Applied_Mathematics'
            },
            {
            	name: 'Arithmetic & Basic Math',
            	link: 'https://math.libretexts.org/Bookshelves/Arithmetic_and_Basic_Math'
            },
            {
            	name: 'Calculus',
            	link: 'https://math.libretexts.org/Bookshelves/Calculus'
            },
            {
            	name: 'Combinatorics & Discrete Mathematics',
            	link: 'https://math.libretexts.org/Bookshelves/Combinatorics_and_Discrete_Mathematics'
            },
            {
            	name: 'Differential Equations',
            	link: 'https://math.libretexts.org/Bookshelves/Differential_Equations'
            },
            {
            	name: 'Geometry',
            	link: 'https://math.libretexts.org/Bookshelves/Geometry'
            },
            {
            	name: 'Linear Algebra',
            	link: 'https://math.libretexts.org/Bookshelves/Linear_Algebra'
            },
            {
            	name: 'Mathematical Logic & Proofs',
            	link: 'https://math.libretexts.org/Bookshelves/Mathematical_Logic_and_Proof'
            },
            {
            	name: 'Scientific Computing, Simulations, and Modeling',
            	link: 'https://math.libretexts.org/Bookshelves/Scientific_Computing_Simulations_and_Modeling'
            },
            {
            	name: 'Pre-Algebra',
            	link: 'https://math.libretexts.org/Bookshelves/PreAlgebra'
            },
            {
            	name: 'Precalculus & Trigonometry',
            	link: 'https://math.libretexts.org/Bookshelves/Precalculus'
            }
        ]
    },
    {
        key: 'med',
        name: 'Medicine',
        thumbnail: '/libicons/med.png',
        link: 'https://med.libretexts.org',
        shelves: [
            {
            	name: 'Allied Health',
            	link: 'https://med.libretexts.org/Bookshelves/Allied_Health'
            },
            {
            	name: 'Anatomy & Physiology',
            	link: 'https://med.libretexts.org/Bookshelves/Anatomy_and_Physiology'
            },
            {
            	name: 'Health & Fitness',
            	link: 'https://med.libretexts.org/Bookshelves/Health_and_Fitness'
            },
            {
            	name: 'Medicine',
            	link: 'https://med.libretexts.org/Bookshelves/Medicine'
            },
            {
            	name: 'Nursing',
            	link: 'https://med.libretexts.org/Bookshelves/Nursing'
            },
            {
            	name: 'Nutrition',
            	link: 'https://med.libretexts.org/Bookshelves/Nutrition'
            },
            {
            	name: 'Pharmacology & Neuroscience',
            	link: 'https://med.libretexts.org/Bookshelves/Pharmacology_and_Neuroscience'
            },
            {
            	name: 'Veterinary Medicine',
            	link: 'https://med.libretexts.org/Bookshelves/Veterinary_Medicine'
            }
        ]
    },
    {
        key: 'phys',
        name: 'Physics',
        thumbnail: '/libicons/phys.png',
        link: 'https://phys.libretexts.org',
        shelves: [
            {
            	name: 'Astronomy & Cosmoloogy',
            	link: 'https://phys.libretexts.org/Bookshelves/Astronomy__Cosmology'
            },
            {
            	name: 'Classical Mechanics',
            	link: 'https://phys.libretexts.org/Bookshelves/Classical_Mechanics'
            },
            {
            	name: 'College',
            	link: 'https://phys.libretexts.org/Bookshelves/College_Physics'
            },
            {
            	name: 'Conceptual',
            	link: 'https://phys.libretexts.org/Bookshelves/Conceptual_Physics'
            },
            {
            	name: 'Electricity & Magnetism',
            	link: 'https://phys.libretexts.org/Bookshelves/Electricity_and_Magnetism'
            },
            {
            	name: 'Mathematical Physics & Pedagogy',
            	link: 'https://phys.libretexts.org/Bookshelves/Mathematical_Physics_and_Pedagogy'
            },
            {
            	name: 'Modern Physics',
            	link: 'https://phys.libretexts.org/Bookshelves/Modern_Physics'
            },
            {
            	name: 'Nuclear & Particle Physics',
            	link: 'https://phys.libretexts.org/Bookshelves/Nuclear_and_Particle_Physics'
            },
            {
            	name: 'Optics',
            	link: 'https://phys.libretexts.org/Bookshelves/Optics'
            },
            {
            	name: 'Quantum Mechanics',
            	link: 'https://phys.libretexts.org/Bookshelves/Quantum_Mechanics'
            },
            {
            	name: 'Relativity',
            	link: 'https://phys.libretexts.org/Bookshelves/Relativity'
            },
            {
            	name: 'Thermodynamics & Statistical Mechanics',
            	link: 'https://phys.libretexts.org/Bookshelves/Thermodynamics_and_Statistical_Mechanics'
            },
            {
            	name: 'University',
            	link: 'https://phys.libretexts.org/Bookshelves/University_Physics'
            },
            {
            	name: 'Waves & Acoustics',
            	link: 'https://phys.libretexts.org/Bookshelves/Waves_and_Acoustics'
            }
        ]
    },
    {
        key: 'socialsci',
        name: 'Social Sciences',
        thumbnail: '/libicons/socialsci.png',
        link: 'https://socialsci.libretexts.org',
        shelves: [
            {
            	name: 'Anthropology',
            	link: 'https://socialsci.libretexts.org/Bookshelves/Anthropology'
            },
            {
            	name: 'Communication Studies',
            	link: 'https://socialsci.libretexts.org/Bookshelves/Communication'
            },
            {
            	name: 'Counseling & Guidance',
            	link: 'https://socialsci.libretexts.org/Bookshelves/Counseling_and_Guidance'
            },
            {
            	name: 'Early Childhood Education',
            	link: 'https://socialsci.libretexts.org/Bookshelves/Early_Childhood_Education'
            },
            {
            	name: 'Economics',
            	link: 'https://socialsci.libretexts.org/Bookshelves/Economics'
            },
            {
            	name: 'Education & Professional Development',
            	link: 'https://socialsci.libretexts.org/Bookshelves/Education_and_Professional_Development'
            },
            {
            	name: 'Human Development',
            	link: 'https://socialsci.libretexts.org/Bookshelves/Human_Development'
            },
            {
            	name: 'Human Geography',
            	link: 'https://socialsci.libretexts.org/Bookshelves/Geography_(Human)'
            },
            {
            	name: 'Political Science & Civics',
            	link: 'https://socialsci.libretexts.org/Bookshelves/Political_Science_and_Civics'
            },
            {
            	name: 'Psychology',
            	link: 'https://socialsci.libretexts.org/Bookshelves/Psychology'
            },
            {
            	name: 'Social Work & Human Services',
            	link: 'https://socialsci.libretexts.org/Bookshelves/Social_Work_and_Human_Services'
            },
            {
            	name: 'Sociology',
            	link: 'https://socialsci.libretexts.org/Bookshelves/Sociology'
            }
        ]
    },
    {
        key: 'stats',
        name: 'Statistics',
        thumbnail: '/libicons/stats.png',
        link: 'https://stats.libretexts.org',
        shelves: [
            {
            	name: 'Applied Statistics',
            	link: 'https://stats.libretexts.org/Bookshelves/Applied_Statistics'
            },
            {
            	name: 'Computing & Modeling',
            	link: 'https://stats.libretexts.org/Bookshelves/Computing_and_Modeling'
            },
            {
            	name: 'Introductory Statistics',
            	link: 'https://stats.libretexts.org/Bookshelves/Introductory_Statistics'
            },
            {
            	name: 'Probability Theory',
            	link: 'https://stats.libretexts.org/Bookshelves/Probability_Theory'
            },
            {
            	name: 'Time Series Analysis',
            	link: 'https://stats.libretexts.org/Bookshelves/Book%3A_Time_Series_Analysis_(Aue)'
            }
        ]
    },
    {
        key: 'workforce',
        name: 'Workforce',
        thumbnail: '/libicons/workforce.png',
        link: 'https://workforce.libretexts.org',
        shelves: [
            {
            	name: 'Allied Health',
            	link: 'https://workforce.libretexts.org/Bookshelves/Allied_Health'
            },
            {
            	name: 'Arts, Audio Visual Technology, and Communications',
            	link: 'https://workforce.libretexts.org/Bookshelves/Arts_Audio_Visual_Technology_and_Communications'
            },
            {
            	name: 'Computer Applications & Information Technology',
            	link: 'https://workforce.libretexts.org/Bookshelves/Information_Technology'
            },
            {
            	name: 'Construction',
            	link: 'https://workforce.libretexts.org/Bookshelves/Construction'
            },
            {
            	name: 'Corrections',
            	link: 'https://workforce.libretexts.org/Bookshelves/Corrections'
            },
            {
            	name: 'Electronics Technology',
            	link: 'https://workforce.libretexts.org/Bookshelves/Electronics_Technology'
            },
            {
            	name: 'HVAC & Power Plant Operations',
            	link: 'https://workforce.libretexts.org/Bookshelves/HVAC_and_Power_Plant_Operations'
            },
            {
            	name: 'Hospitality',
            	link: 'https://workforce.libretexts.org/Bookshelves/Hospitality'
            },
            {
            	name: 'Manufacturing',
            	link: 'https://workforce.libretexts.org/Bookshelves/Manufacturing'
            },
            {
            	name: 'Water Systems',
            	link: 'https://workforce.libretexts.org/Bookshelves/Water_Systems_Technology'
            }
        ]
    }
];

const libraryNameKeys = [
    'bio',
    'biz',
    'chem',
    'eng',
    'espanol',
    'geo',
    'human',
    'k12',
    'math',
    'med',
    'phys',
    'socialsci',
    'stats',
    'workforce',
    'ukrayinska'
];

export {
  libraries as default,
  libraryNameKeys,
}
