// DEPRECATED — PHASING OUT (08/27/2021)

const licenseOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'arr', text: 'All Rights Reserved', value: 'arr' },
    { key: 'cc-by', text: 'CC-BY', value: 'cc-by' },
    { key: 'cc-by-nc', text: 'CC-BY-NC', value: 'cc-by-nc' },
    { key: 'cc-by-nc-nd', text: 'CC-BY-NC-ND', value: 'cc-by-nc-nd' },
    { key: 'cc-by-nc-sa', text: 'CC-BY-NC-SA', value: 'cc-by-nc-sa' },
    { key: 'cc-by-nd', text: 'CC-BY-ND', value: 'cc-by-nd' },
    { key: 'cc-by-sa', text: 'CC-BY-SA', value: 'cc-by-sa' },
    { key: 'gnu-dsl', text: 'GNU DSL', value: 'gnu-dsl' },
    { key: 'gnu-fdl', text: 'GNU FDL', value: 'gnu-fdl' },
    { key: 'gnu-gpl', text: 'GNU GPL', value: 'gnu-gpl' },
    { key: 'pd', text: 'Public Domain', value: 'pd' },
];

const textUseOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'primary', text: 'As the primary textbook', value: 'primary' },
    { key: 'supplement', text: 'As supplementary material', value: 'supplement' },
    { key: 'remix', text: 'As part of a remix that I am creating for my class', value: 'remix' },
    { key: 'other', text: 'Other (please explain in comments)', value: 'other' },
];

const libraryOptions = [
    { key: 'empty', text: 'Clear...', value: "" },
    { key: 'biology', text: 'Biology', value: 'biology' },
    { key: 'business', text: 'Business', value: 'business' },
    { key: 'chemistry', text: 'Chemistry', value: 'chemistry' },
    { key: 'engineering', text: 'Engineering', value: 'engineering' },
    { key: 'espanol', text: 'Español', value: 'espanol' },
    { key: 'geosciences', text: 'Geosciences', value: 'geosciences' },
    { key: 'humanities', text: 'Humanities', value: 'humanities' },
    { key: 'mathematics', text: 'Mathematics', value: 'mathematics' },
    { key: 'medicine', text: 'Medicine', value: 'medicine' },
    { key: 'physics', text: 'Physics', value: 'physics' },
    { key: 'social_science', text: 'Social Science', value: 'social_science' },
    { key: 'statistics', text: 'Statistics', value: 'statistics' },
    { key: 'workforce', text: 'Workforce', value: 'workforce' }
];

const biologyOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'bio_introductory_and_general_biology', text: 'Introductory and General Biology', value: 'bio_introductory_and_general_biology' },
    { key: 'bio_cell_and_molecular_biology', text: 'Cell and Molecular Biology', value: 'bio_cell_and_molecular_biology' },
    { key: 'bio_biochemistry', text: 'Biochemistry', value: 'bio_biochemistry' },
    { key: 'bio_botany', text: 'Botany', value: 'bio_botany' },
    { key: 'bio_ecology', text: 'Ecology', value: 'bio_ecology' },
    { key: 'bio_evolutionary_developmental_biology', text: 'Evolutionary Developmental Biology', value: 'bio_evolutionary_developmental_biology' },
    { key: 'bio_genetics', text: 'Genetics', value: 'bio_genetics' },
    { key: 'bio_human_biology', text: 'Human Biology', value: 'bio_human_biology' },
    { key: 'bio_microbiology', text: 'Microbiology', value: 'bio_microbiology' },
    { key: 'bio_biotechnology', text: 'Biotechnology', value: 'bio_biotechnology' },
    { key: 'bio_computational_biotechnology', text: 'Computational Biotechnology', value: 'bio_computational_biotechnology' },
    { key: 'bio_ancillary_materials', text: 'Ancillary Materials', value: 'bio_ancillary_materials' }
];

const businessOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'business_accounting', text: 'Accounting', value: 'business_accounting' },
    { key: 'business_business', text: 'Business', value: 'business_business' },
    { key: 'business_finance', text: 'Finance', value: 'business_finance' },
    { key: 'business_management', text: 'Management', value: 'business_management' },
    { key: 'business_marketing', text: 'Marketing', value: 'business_marketing' },
    { key: 'business_law', text: 'Law', value: 'business_law' }
];

const chemistryOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'chem_introductory_conceptual_and_gob_biochemistry', text: 'Introductory, Conceptual, and GOB Biochemistry', value: 'chem_introductory_conceptual_and_gob_biochemistry' },
    { key: 'chem_general_chemistry', text: 'General Chemistry', value: 'chem_general_chemistry' },
    { key: 'chem_organic_chemistry', text: 'Organic Chemistry', value: 'chem_organic_chemistry' },
    { key: 'chem_inorganic_chemistry', text: 'Inorganic Chemistry', value: 'chem_inorganic_chemistry' },
    { key: 'chem_analytical_chemistry', text: 'Analytical Chemistry', value: 'chem_analytical_chemistry' },
    { key: 'chem_physical_and_theoretical_chemistry', text: 'Physical & Theoretical Chemistry', value: 'chem_physical_and_theoretical_chemistry' },
    { key: 'chem_biological_chemistry', text: 'Biological Chemistry', value: 'chem_biological_chemistry' },
    { key: 'chem_environmental_chemistry', text: 'Environmental Chemistry', value: 'chem_environmental_chemistry' },
    { key: 'chem_ancillary_materials', text: 'Ancillary Materials', value: 'chem_ancillary_materials' }
];

const engineeringOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'eng_chemical_engineering', text: 'Chemical Engineering', value: 'eng_chemical_engineering' },
    { key: 'eng_civil_engineering', text: 'Civil Engineering', value: 'eng_civil_engineering' },
    { key: 'eng_computer_science', text: 'Computer Science', value: 'eng_computer_science' },
    { key: 'eng_electrical_engineering', text: 'Electrical Engineering', value: 'eng_electrical_engineering' },
    { key: 'eng_environmental_engineering_sustainability_and_conservation', text: 'Environmental Engineering (Sustainability and Conservation)', value: 'eng_environmental_engineering_sustainability_and_conservation' },
    { key: 'eng_industrial_and_systems_engineering', text: 'Industrial and Systems Engineering', value: 'eng_industrial_and_systems_engineering' },
    { key: 'eng_materials_science', text: 'Materials Science', value: 'eng_materials_science' },
    { key: 'eng_mechanical_engineering', text: 'Mechanical Engineering', value: 'eng_mechanical_engineering' }
];

const espanolOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'espanol_biologia', text: 'Biología', value: 'espanol_biologia' },
    { key: 'espanol_ciencias_sociales', text: 'Ciencias Sociales', value: 'espanol_ciencias_sociales' },
    { key: 'espanol_estadistica', text: 'Estadística', value: 'espanol_estadistica' },
    { key: 'espanol_fisica', text: 'Física', value: 'espanol_fisica' },
    { key: 'espanol_geociencias', text: 'Geociencias', value: 'espanol_geociencias' },
    { key: 'espanol_humanidades', text: 'Humanidades', value: 'espanol_humanidades' },
    { key: 'espanol_ingenieria', text: 'Ingenieria', value: 'espanol_ingenieria' },
    { key: 'espanol_matematicas', text: 'Matemáticas', value: 'espanol_matematicas' },
    { key: 'espanol_medicina', text: 'Medicina', value: 'espanol_medicina' },
    { key: 'espanol_negocio', text: 'Negocio', value: 'espanol_negocio' },
    { key: 'espanol_quimica', text: 'Química', value: 'espanol_quimica' },
    { key: 'espanol_vocacional', text: 'Vocacional', value: 'espanol_vocacional' }
];

const geosciencesOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'geo_geography_physical', text: 'Geography (Physical)', value: 'geo_geography_physical' },
    { key: 'geo_geology', text: 'Geology', value: 'geo_geology' },
    { key: 'geo_meteorology', text: 'Meteorology', value: 'geo_meteorology' },
    { key: 'geo_oceanography', text: 'Oceanography', value: 'geo_oceanography' },
    { key: 'geo_sedimentology', text: 'Sedimentology', value: 'geo_sedimentology' },
    { key: 'geo_seismology', text: 'Seismology', value: 'geo_seismology' },
    { key: 'geo_ancillary_materials', text: 'Ancillary Materials', value: 'geo_ancillary_materials' }
];

const humanitiesOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'hum_art', text: 'Art', value: 'hum_art' },
    { key: 'hum_composition', text: 'Composition', value: 'hum_composition' },
    { key: 'hum_gender_studies', text: 'Gender Studies', value: 'hum_gender_studies' },
    { key: 'hum_religious_studies', text: 'Religious Studies', value: 'hum_religious_studies' },
    { key: 'hum_history', text: 'History', value: 'hum_history' },
    { key: 'hum_languages', text: 'Languages', value: 'hum_languages' },
    { key: 'hum_literature_and_literacy', text: 'Literature & Literacy', value: 'hum_literature_and_literacy' },
    { key: 'hum_music', text: 'Music', value: 'hum_music' },
    { key: 'hum_philosophy', text: 'Philosophy', value: 'hum_philosophy' },
    { key: 'hum_research_and_information_literacy', text: 'Research and Information Literacy', value: 'hum_research_and_information_literacy' },
    { key: 'hum_theater_and_film', text: 'Theater & Film', value: 'hum_theater_and_film' },
    { key: 'hum_visualizations_and_simulations', text: 'Visualizations and Simulations', value: 'hum_visualizations_and_simulations' }
];

const mathematicsOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'math_arithmetic_and_basic_math', text: 'Arithmetic & Basic Math', value: 'math_arithmetic_and_basic_math' },
    { key: 'math_pre-algebra', text: 'Pre-Algebra', value: 'math_pre-algebra' },
    { key: 'math_algebra', text: 'Algebra', value: 'math_algebra' },
    { key: 'math_geometry', text: 'Geometry', value: 'math_geometry' },
    { key: 'math_precalculus_and_trigonometry', text: 'Precalculus & Trigonometry', value: 'math_precalculus_and_trigonometry' },
    { key: 'math_calculus', text: 'Calculus', value: 'math_calculus' },
    { key: 'math_differential_equations', text: 'Differential Equations', value: 'math_differential_equations' },
    { key: 'math_analysis', text: 'Analysis', value: 'math_analysis' },
    { key: 'math_linear_algebra', text: 'Linear Algebra', value: 'math_linear_algebra' },
    { key: 'math_abstract_and_geometric_algebra', text: 'Abstract and Geometric Algebra', value: 'math_abstract_and_geometric_algebra' },
    { key: 'math_combinatorics_and_discrete_mathematics', text: 'Combinatorics and Discrete Mathematics', value: 'math_combinatorics_and_discrete_mathematics' },
    { key: 'math_mathematical_logic_and_proofs', text: 'Mathematical Logic and Proofs', value: 'math_mathematical_logic_and_proofs' },
    { key: 'math_applied_mathematics', text: 'Applied Mathematics', value: 'math_applied_mathematics' },
    { key: 'math_scientific_computing_simulations_and_modeling', text: 'Scientific Computing, Simulations, and Modeling', value: 'math_scientific_computing_simulations_and_modeling' },
    { key: 'math_visualizations_and_simulations', text: 'Visualizations and Simulations', value: 'math_visualizations_and_simulations' }
];

const medicineOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'med_allied_health', text: 'Allied Health', value: 'med_allied_health' },
    { key: 'med_anatomy_and_physiology', text: 'Anatomy and Physiology', value: 'med_anatomy_and_physiology' },
    { key: 'med_health', text: 'Health', value: 'med_health' },
    { key: 'med_medicine', text: 'Medicine', value: 'med_medicine' },
    { key: 'med_nutrition', text: 'Nutrition', value: 'med_nutrition' },
    { key: 'med_nursing', text: 'Nursing', value: 'med_nursing' },
    { key: 'med_pharmacology_and_neuroscience', text: 'Pharmacology and Neuroscience', value: 'med_pharmacology_and_neuroscience' },
    { key: 'med_veterinary_medicine', text: 'Veterinary Medicine', value: 'med_veterinary_medicine' },
    { key: 'med_ancillary_materials', text: 'Ancillary Materials', value: 'med_ancillary_materials' }
];

const physicsOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'phys_conceptual_physics', text: 'Conceptual Physics', value: 'phys_conceptual_physics' },
    { key: 'phys_college_physics', text: 'College Physics', value: 'phys_college_physics' },
    { key: 'phys_university_physics', text: 'University Physics', value: 'phys_university_physics' },
    { key: 'phys_classical_mechanics', text: 'Classical Mechanics', value: 'phys_classical_mechanics' },
    { key: 'phys_thermodynamics_and_statistical_mechanics', text: 'Thermodynamics and Statistical Mechanics', value: 'phys_thermodynamics_and_statistical_mechanics' },
    { key: 'phys_quantum_mechanics', text: 'Quantum Mechanics', value: 'phys_quantum_mechanics' },
    { key: 'phys_relativity', text: 'Relativity', value: 'phys_relativity' },
    { key: 'phys_astronomy_and_cosmology', text: 'Astronomy & Cosmology', value: 'phys_astronomy_and_cosmology' },
    { key: 'phys_electricity_and_magnetism', text: 'Electricity and Magnetism', value: 'phys_electricity_and_magnetism' },
    { key: 'phys_optics', text: 'Optics', value: 'phys_optics' },
    { key: 'phys_acoustics', text: 'Acoustics', value: 'phys_acoustics' },
    { key: 'phys_modern_physics', text: 'Modern Physics', value: 'phys_modern_physics' },
    { key: 'phys_nuclear_and_particle_physics', text: 'Nuclear and Particle Physics', value: 'phys_nuclear_and_particle_physics' },
    { key: 'phys_math_methods_and_pedagogy', text: 'Math Methods and Pedagogy', value: 'phys_math_methods_and_pedagogy' },
    { key: 'phys_ancillary_materials', text: 'Ancillary Materials', value: 'phys_ancillary_materials' }
];

const socialScienceOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'socsci_anthropology', text: 'Anthropology', value: 'soc_scianthropology' },
    { key: 'socsci_communication_studies', text: 'Communication Studies', value: 'soc_scicommunication_studies' },
    { key: 'socsci_counseling_and_guidance', text: 'Counseling & Guidance', value: 'soc_scicounseling_and_guidance' },
    { key: 'socsci_economics', text: 'Economics', value: 'soc_scieconomics' },
    { key: 'socsci_early_childhood_education', text: 'Early Childhood Education', value: 'soc_sciearly_childhood_education' },
    { key: 'socsci_education_and_professional_development', text: 'Education and Professional Development', value: 'soc_scieducation_and_professional_development' },
    { key: 'socsci_geography_human', text: 'Geography (Human)', value: 'soc_scigeography_human' },
    { key: 'socsci_human_development', text: 'Human Development', value: 'soc_scihuman_development' },
    { key: 'socsci_political_science_and_civics', text: 'Political Science and Civics', value: 'soc_scipolitical_science_and_civics' },
    { key: 'socsci_psychology', text: 'Psychology', value: 'soc_scipsychology' },
    { key: 'socsci_social_work', text: 'Social Work', value: 'soc_scisocial_work' },
    { key: 'socsci_sociology', text: 'Sociology', value: 'soc_scisociology' },
    { key: 'socsci_ancillary_materials', text: 'Ancillary Materials', value: 'soc_sciancillary_materials' },
];

const statisticsOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'stat_introductory_statistics', text: 'Introductory Statistics', value: 'stat_introductory_statistics' },
    { key: 'stat_probability_theory', text: 'Probability Theory', value: 'stat_probability_theory' },
    { key: 'stat_computing_and_modeling', text: 'Computing and Modeling', value: 'stat_computing_and_modeling' },
    { key: 'stat_applied_statistics', text: 'Applied Statistics', value: 'stat_applied_statistics' },
    { key: 'stat_ancillary_materials', text: 'Ancillary Materials', value: 'stat_ancillary_materials' }
];

const workforceOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'work_allied_health', text: 'Allied Health', value: 'work_allied_health' },
    { key: 'work_arts_audio_visual_technology_and_communications', text: 'Arts, Audio/Visual Technology, and Communications', value: 'work_arts_audio_visual_technology_and_communications' },
    { key: 'work_construction', text: 'Construction', value: 'work_construction' },
    { key: 'work_electronics_technology', text: 'Electronics Technology', value: 'work_electronics_technology' },
    { key: 'work_hospitality', text: 'Hospitality', value: 'work_hospitality' },
    { key: 'work_hvac_and_power_plant_operations', text: 'HVAC and Power Plant Operations', value: 'work_hvac_and_power_plant_operations' },
    { key: 'work_information_technology', text: 'Information Technology', value: 'work_information_technology' },
    { key: 'work_manufacturing', text: 'Manufacturing', value: 'work_manufacturing' },
    { key: 'work_water_systems_technology', text: 'Water Systems Technology', value: 'work_water_systems_technology' }
];

const typeOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'pdf', text: 'PDF', value: 'pdf' },
    { key: 'eBook', text: 'External eBook', value: 'eBook' },
    { key: 'hardcopy', text: 'Hardcopy', value: 'Hardcopy' },
    { key: 'epub', text: 'EPUB', value: 'EPUB' }
];
const statusOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'ready', text: 'Ready', value: 'ready' },
    { key: 'wait', text: 'Waiting for permission', value: 'wait' },
    { key: 'review', text: 'Needs further review', value: 'review' }
];

const allShelfOptions = [
    { key: 'bio_introductory_and_general_biology', text: 'Introductory and General Biology', value: 'bio_introductory_and_general_biology' },
    { key: 'bio_cell_and_molecular_biology', text: 'Cell and Molecular Biology', value: 'bio_cell_and_molecular_biology' },
    { key: 'bio_biochemistry', text: 'Biochemistry', value: 'bio_biochemistry' },
    { key: 'bio_botany', text: 'Botany', value: 'bio_botany' },
    { key: 'bio_ecology', text: 'Ecology', value: 'bio_ecology' },
    { key: 'bio_evolutionary_developmental_biology', text: 'Evolutionary Developmental Biology', value: 'bio_evolutionary_developmental_biology' },
    { key: 'bio_genetics', text: 'Genetics', value: 'bio_genetics' },
    { key: 'bio_human_biology', text: 'Human Biology', value: 'bio_human_biology' },
    { key: 'bio_microbiology', text: 'Microbiology', value: 'bio_microbiology' },
    { key: 'bio_biotechnology', text: 'Biotechnology', value: 'bio_biotechnology' },
    { key: 'bio_computational_biotechnology', text: 'Computational Biotechnology', value: 'bio_computational_biotechnology' },
    { key: 'bio_ancillary_materials', text: 'Ancillary Materials', value: 'bio_ancillary_materials' },
    { key: 'business_accounting', text: 'Accounting', value: 'business_accounting' },
    { key: 'business_business', text: 'Business', value: 'business_business' },
    { key: 'business_finance', text: 'Finance', value: 'business_finance' },
    { key: 'business_management', text: 'Management', value: 'business_management' },
    { key: 'business_marketing', text: 'Marketing', value: 'business_marketing' },
    { key: 'business_law', text: 'Law', value: 'business_law' },
    { key: 'chem_introductory_conceptual_and_gob_biochemistry', text: 'Introductory, Conceptual, and GOB Biochemistry', value: 'chem_introductory_conceptual_and_gob_biochemistry' },
    { key: 'chem_general_chemistry', text: 'General Chemistry', value: 'chem_general_chemistry' },
    { key: 'chem_organic_chemistry', text: 'Organic Chemistry', value: 'chem_organic_chemistry' },
    { key: 'chem_inorganic_chemistry', text: 'Inorganic Chemistry', value: 'chem_inorganic_chemistry' },
    { key: 'chem_analytical_chemistry', text: 'Analytical Chemistry', value: 'chem_analytical_chemistry' },
    { key: 'chem_physical_and_theoretical_chemistry', text: 'Physical & Theoretical Chemistry', value: 'chem_physical_and_theoretical_chemistry' },
    { key: 'chem_biological_chemistry', text: 'Biological Chemistry', value: 'chem_biological_chemistry' },
    { key: 'chem_environmental_chemistry', text: 'Environmental Chemistry', value: 'chem_environmental_chemistry' },
    { key: 'chem_ancillary_materials', text: 'Ancillary Materials', value: 'chem_ancillary_materials' },
    { key: 'eng_chemical_engineering', text: 'Chemical Engineering', value: 'eng_chemical_engineering' },
    { key: 'eng_civil_engineering', text: 'Civil Engineering', value: 'eng_civil_engineering' },
    { key: 'eng_computer_science', text: 'Computer Science', value: 'eng_computer_science' },
    { key: 'eng_electrical_engineering', text: 'Electrical Engineering', value: 'eng_electrical_engineering' },
    { key: 'eng_environmental_engineering_sustainability_and_conservation', text: 'Environmental Engineering (Sustainability and Conservation)', value: 'eng_environmental_engineering_sustainability_and_conservation' },
    { key: 'eng_industrial_and_systems_engineering', text: 'Industrial and Systems Engineering', value: 'eng_industrial_and_systems_engineering' },
    { key: 'eng_materials_science', text: 'Materials Science', value: 'eng_materials_science' },
    { key: 'eng_mechanical_engineering', text: 'Mechanical Engineering', value: 'eng_mechanical_engineering' },
    { key: 'espanol_biologia', text: 'Biología', value: 'espanol_biologia' },
    { key: 'espanol_ciencias_sociales', text: 'Ciencias Sociales', value: 'espanol_ciencias_sociales' },
    { key: 'espanol_estadistica', text: 'Estadística', value: 'espanol_estadistica' },
    { key: 'espanol_fisica', text: 'Física', value: 'espanol_fisica' },
    { key: 'espanol_geociencias', text: 'Geociencias', value: 'espanol_geociencias' },
    { key: 'espanol_humanidades', text: 'Humanidades', value: 'espanol_humanidades' },
    { key: 'espanol_ingenieria', text: 'Ingenieria', value: 'espanol_ingenieria' },
    { key: 'espanol_matematicas', text: 'Matemáticas', value: 'espanol_matematicas' },
    { key: 'espanol_medicina', text: 'Medicina', value: 'espanol_medicina' },
    { key: 'espanol_negocio', text: 'Negocio', value: 'espanol_negocio' },
    { key: 'espanol_quimica', text: 'Química', value: 'espanol_quimica' },
    { key: 'espanol_vocacional', text: 'Vocacional', value: 'espanol_vocacional' },
    { key: 'geo_geography_physical', text: 'Geography (Physical)', value: 'geo_geography_physical' },
    { key: 'geo_geology', text: 'Geology', value: 'geo_geology' },
    { key: 'geo_meteorology', text: 'Meteorology', value: 'geo_meteorology' },
    { key: 'geo_oceanography', text: 'Oceanography', value: 'geo_oceanography' },
    { key: 'geo_sedimentology', text: 'Sedimentology', value: 'geo_sedimentology' },
    { key: 'geo_seismology', text: 'Seismology', value: 'geo_seismology' },
    { key: 'geo_ancillary_materials', text: 'Ancillary Materials', value: 'geo_ancillary_materials' },
    { key: 'hum_art', text: 'Art', value: 'hum_art' },
    { key: 'hum_composition', text: 'Composition', value: 'hum_composition' },
    { key: 'hum_gender_studies', text: 'Gender Studies', value: 'hum_gender_studies' },
    { key: 'hum_religious_studies', text: 'Religious Studies', value: 'hum_religious_studies' },
    { key: 'hum_history', text: 'History', value: 'hum_history' },
    { key: 'hum_languages', text: 'Languages', value: 'hum_languages' },
    { key: 'hum_literature_and_literacy', text: 'Literature & Literacy', value: 'hum_literature_and_literacy' },
    { key: 'hum_music', text: 'Music', value: 'hum_music' },
    { key: 'hum_philosophy', text: 'Philosophy', value: 'hum_philosophy' },
    { key: 'hum_research_and_information_literacy', text: 'Research and Information Literacy', value: 'hum_research_and_information_literacy' },
    { key: 'hum_theater_and_film', text: 'Theater & Film', value: 'hum_theater_and_film' },
    { key: 'hum_visualizations_and_simulations', text: 'Visualizations and Simulations', value: 'hum_visualizations_and_simulations' },
    { key: 'math_arithmetic_and_basic_math', text: 'Arithmetic & Basic Math', value: 'math_arithmetic_and_basic_math' },
    { key: 'math_pre-algebra', text: 'Pre-Algebra', value: 'math_pre-algebra' },
    { key: 'math_algebra', text: 'Algebra', value: 'math_algebra' },
    { key: 'math_geometry', text: 'Geometry', value: 'math_geometry' },
    { key: 'math_precalculus_and_trigonometry', text: 'Precalculus & Trigonometry', value: 'math_precalculus_and_trigonometry' },
    { key: 'math_calculus', text: 'Calculus', value: 'math_calculus' },
    { key: 'math_differential_equations', text: 'Differential Equations', value: 'math_differential_equations' },
    { key: 'math_analysis', text: 'Analysis', value: 'math_analysis' },
    { key: 'math_linear_algebra', text: 'Linear Algebra', value: 'math_linear_algebra' },
    { key: 'math_abstract_and_geometric_algebra', text: 'Abstract and Geometric Algebra', value: 'math_abstract_and_geometric_algebra' },
    { key: 'math_combinatorics_and_discrete_mathematics', text: 'Combinatorics and Discrete Mathematics', value: 'math_combinatorics_and_discrete_mathematics' },
    { key: 'math_mathematical_logic_and_proofs', text: 'Mathematical Logic and Proofs', value: 'math_mathematical_logic_and_proofs' },
    { key: 'math_applied_mathematics', text: 'Applied Mathematics', value: 'math_applied_mathematics' },
    { key: 'math_scientific_computing_simulations_and_modeling', text: 'Scientific Computing, Simulations, and Modeling', value: 'math_scientific_computing_simulations_and_modeling' },
    { key: 'math_visualizations_and_simulations', text: 'Visualizations and Simulations', value: 'math_visualizations_and_simulations' },
    { key: 'med_allied_health', text: 'Allied Health', value: 'med_allied_health' },
    { key: 'med_anatomy_and_physiology', text: 'Anatomy and Physiology', value: 'med_anatomy_and_physiology' },
    { key: 'med_health', text: 'Health', value: 'med_health' },
    { key: 'med_medicine', text: 'Medicine', value: 'med_medicine' },
    { key: 'med_nutrition', text: 'Nutrition', value: 'med_nutrition' },
    { key: 'med_nursing', text: 'Nursing', value: 'med_nursing' },
    { key: 'med_pharmacology_and_neuroscience', text: 'Pharmacology and Neuroscience', value: 'med_pharmacology_and_neuroscience' },
    { key: 'med_veterinary_medicine', text: 'Veterinary Medicine', value: 'med_veterinary_medicine' },
    { key: 'med_ancillary_materials', text: 'Ancillary Materials', value: 'med_ancillary_materials' },
    { key: 'phys_conceptual_physics', text: 'Conceptual Physics', value: 'phys_conceptual_physics' },
    { key: 'phys_college_physics', text: 'College Physics', value: 'phys_college_physics' },
    { key: 'phys_university_physics', text: 'University Physics', value: 'phys_university_physics' },
    { key: 'phys_classical_mechanics', text: 'Classical Mechanics', value: 'phys_classical_mechanics' },
    { key: 'phys_thermodynamics_and_statistical_mechanics', text: 'Thermodynamics and Statistical Mechanics', value: 'phys_thermodynamics_and_statistical_mechanics' },
    { key: 'phys_quantum_mechanics', text: 'Quantum Mechanics', value: 'phys_quantum_mechanics' },
    { key: 'phys_relativity', text: 'Relativity', value: 'phys_relativity' },
    { key: 'phys_astronomy_and_cosmology', text: 'Astronomy & Cosmology', value: 'phys_astronomy_and_cosmology' },
    { key: 'phys_electricity_and_magnetism', text: 'Electricity and Magnetism', value: 'phys_electricity_and_magnetism' },
    { key: 'phys_optics', text: 'Optics', value: 'phys_optics' },
    { key: 'phys_acoustics', text: 'Acoustics', value: 'phys_acoustics' },
    { key: 'phys_modern_physics', text: 'Modern Physics', value: 'phys_modern_physics' },
    { key: 'phys_nuclear_and_particle_physics', text: 'Nuclear and Particle Physics', value: 'phys_nuclear_and_particle_physics' },
    { key: 'phys_math_methods_and_pedagogy', text: 'Math Methods and Pedagogy', value: 'phys_math_methods_and_pedagogy' },
    { key: 'phys_ancillary_materials', text: 'Ancillary Materials', value: 'phys_ancillary_materials' },
    { key: 'socsci_anthropology', text: 'Anthropology', value: 'soc_scianthropology' },
    { key: 'socsci_communication_studies', text: 'Communication Studies', value: 'soc_scicommunication_studies' },
    { key: 'socsci_counseling_and_guidance', text: 'Counseling & Guidance', value: 'soc_scicounseling_and_guidance' },
    { key: 'socsci_economics', text: 'Economics', value: 'soc_scieconomics' },
    { key: 'socsci_early_childhood_education', text: 'Early Childhood Education', value: 'soc_sciearly_childhood_education' },
    { key: 'socsci_education_and_professional_development', text: 'Education and Professional Development', value: 'soc_scieducation_and_professional_development' },
    { key: 'socsci_geography_human', text: 'Geography (Human)', value: 'soc_scigeography_human' },
    { key: 'socsci_human_development', text: 'Human Development', value: 'soc_scihuman_development' },
    { key: 'socsci_political_science_and_civics', text: 'Political Science and Civics', value: 'soc_scipolitical_science_and_civics' },
    { key: 'socsci_psychology', text: 'Psychology', value: 'soc_scipsychology' },
    { key: 'socsci_social_work', text: 'Social Work', value: 'soc_scisocial_work' },
    { key: 'socsci_sociology', text: 'Sociology', value: 'soc_scisociology' },
    { key: 'socsci_ancillary_materials', text: 'Ancillary Materials', value: 'soc_sciancillary_materials' },
    { key: 'stat_introductory_statistics', text: 'Introductory Statistics', value: 'stat_introductory_statistics' },
    { key: 'stat_probability_theory', text: 'Probability Theory', value: 'stat_probability_theory' },
    { key: 'stat_computing_and_modeling', text: 'Computing and Modeling', value: 'stat_computing_and_modeling' },
    { key: 'stat_applied_statistics', text: 'Applied Statistics', value: 'stat_applied_statistics' },
    { key: 'stat_ancillary_materials', text: 'Ancillary Materials', value: 'stat_ancillary_materials' },
    { key: 'work_allied_health', text: 'Allied Health', value: 'work_allied_health' },
    { key: 'work_arts_audio_visual_technology_and_communications', text: 'Arts, Audio/Visual Technology, and Communications', value: 'work_arts_audio_visual_technology_and_communications' },
    { key: 'work_construction', text: 'Construction', value: 'work_construction' },
    { key: 'work_electronics_technology', text: 'Electronics Technology', value: 'work_electronics_technology' },
    { key: 'work_hospitality', text: 'Hospitality', value: 'work_hospitality' },
    { key: 'work_hvac_and_power_plant_operations', text: 'HVAC and Power Plant Operations', value: 'work_hvac_and_power_plant_operations' },
    { key: 'work_information_technology', text: 'Information Technology', value: 'work_information_technology' },
    { key: 'work_manufacturing', text: 'Manufacturing', value: 'work_manufacturing' },
    { key: 'work_water_systems_technology', text: 'Water Systems Technology', value: 'work_water_systems_technology' }
];

const allShelfMap = new Map([
    ['bio_introductory_and_general_biology', 'Introductory and General Biology'],
    ['bio_cell_and_molecular_biology', 'Cell and Molecular Biology'],
    ['bio_biochemistry', 'Biochemistry'],
    ['bio_botany', 'Botany'],
    ['bio_ecology', 'Ecology'],
    ['bio_evolutionary_developmental_biology', 'Evolutionary Developmental Biology'],
    ['bio_genetics', 'Genetics'],
    ['bio_human_biology', 'Human Biology'],
    ['bio_microbiology', 'Microbiology'],
    ['bio_biotechnology', 'Biotechnology'],
    ['bio_computational_biotechnology', 'Computational Biotechnology'],
    ['bio_ancillary_materials', 'Ancillary Materials'],
    ['business_accounting', 'Accounting'],
    ['business_business', 'Business'],
    ['business_finance', 'Finance'],
    ['business_management', 'Management'],
    ['business_marketing', 'Marketing'],
    ['business_law', 'Law'],
    ['chem_introductory_conceptual_and_gob_biochemistry', 'Introductory, Conceptual, and GOB Biochemistry'],
    ['chem_general_chemistry', 'General Chemistry'],
    ['chem_organic_chemistry', 'Organic Chemistry'],
    ['chem_inorganic_chemistry', 'Inorganic Chemistry'],
    ['chem_analytical_chemistry', 'Analytical Chemistry'],
    ['chem_physical_and_theoretical_chemistry', 'Physical & Theoretical Chemistry'],
    ['chem_biological_chemistry', 'Biological Chemistry'],
    ['chem_environmental_chemistry', 'Environmental Chemistry'],
    ['chem_ancillary_materials', 'Ancillary Materials'],
    ['eng_chemical_engineering', 'Chemical Engineering'],
    ['eng_civil_engineering', 'Civil Engineering'],
    ['eng_computer_science', 'Computer Science'],
    ['eng_electrical_engineering', 'Electrical Engineering'],
    ['eng_environmental_engineering_sustainability_and_conservation', 'Environmental Engineering (Sustainability and Conservation)'],
    ['eng_industrial_and_systems_engineering', 'Industrial and Systems Engineering'],
    ['eng_materials_science', 'Materials Science'],
    ['eng_mechanical_engineering', 'Mechanical Engineering'],
    ['espanol_biologia', 'Biología'],
    ['espanol_ciencias_sociales', 'Ciencias Sociales'],
    ['espanol_estadistica', 'Estadística'],
    ['espanol_fisica', 'Física'],
    ['espanol_geociencias', 'Geociencias'],
    ['espanol_humanidades', 'Humanidades'],
    ['espanol_ingenieria', 'Ingenieria'],
    ['espanol_matematicas', 'Matemáticas'],
    ['espanol_medicina', 'Medicina'],
    ['espanol_negocio', 'Negocio'],
    ['espanol_quimica', 'Química'],
    ['espanol_vocacional', 'Vocacional'],
    ['geo_geography_physical', 'Geography (Physical)'],
    ['geo_geology', 'Geology'],
    ['geo_meteorology', 'Meteorology'],
    ['geo_oceanography', 'Oceanography'],
    ['geo_sedimentology', 'Sedimentology'],
    ['geo_seismology', 'Seismology'],
    ['geo_ancillary_materials', 'Ancillary Materials'],
    ['hum_art', 'Art'],
    ['hum_composition', 'Composition'],
    ['hum_gender_studies', 'Gender Studies'],
    ['hum_religious_studies', 'Religious Studies'],
    ['hum_history', 'History'],
    ['hum_languages', 'Languages'],
    ['hum_literature_and_literacy', 'Literature & Literacy'],
    ['hum_music', 'Music'],
    ['hum_philosophy', 'Philosophy'],
    ['hum_research_and_information_literacy', 'Research and Information Literacy'],
    ['hum_theater_and_film', 'Theater & Film'],
    ['hum_visualizations_and_simulations', 'Visualizations and Simulations'],
    ['math_arithmetic_and_basic_math', 'Arithmetic & Basic Math'],
    ['math_pre-algebra', 'Pre-Algebra'],
    ['math_algebra', 'Algebra'],
    ['math_geometry', 'Geometry'],
    ['math_precalculus_and_trigonometry', 'Precalculus & Trigonometry'],
    ['math_calculus', 'Calculus'],
    ['math_differential_equations', 'Differential Equations'],
    ['math_analysis', 'Analysis'],
    ['math_linear_algebra', 'Linear Algebra'],
    ['math_abstract_and_geometric_algebra', 'Abstract and Geometric Algebra'],
    ['math_combinatorics_and_discrete_mathematics', 'Combinatorics and Discrete Mathematics'],
    ['math_mathematical_logic_and_proofs', 'Mathematical Logic and Proofs'],
    ['math_applied_mathematics', 'Applied Mathematics'],
    ['math_scientific_computing_simulations_and_modeling', 'Scientific Computing, Simulations, and Modeling'],
    ['math_visualizations_and_simulations', 'Visualizations and Simulations'],
    ['med_allied_health', 'Allied Health'],
    ['med_anatomy_and_physiology', 'Anatomy and Physiology'],
    ['med_health', 'Health'],
    ['med_medicine', 'Medicine'],
    ['med_nutrition', 'Nutrition'],
    ['med_nursing', 'Nursing'],
    ['med_pharmacology_and_neuroscience', 'Pharmacology and Neuroscience'],
    ['med_veterinary_medicine', 'Veterinary Medicine'],
    ['med_ancillary_materials', 'Ancillary Materials'],
    ['phys_conceptual_physics', 'Conceptual Physics'],
    ['phys_college_physics', 'College Physics'],
    ['phys_university_physics', 'University Physics'],
    ['phys_classical_mechanics', 'Classical Mechanics'],
    ['phys_thermodynamics_and_statistical_mechanics', 'Thermodynamics and Statistical Mechanics'],
    ['phys_quantum_mechanics', 'Quantum Mechanics'],
    ['phys_relativity', 'Relativity'],
    ['phys_astronomy_and_cosmology', 'Astronomy & Cosmology'],
    ['phys_electricity_and_magnetism', 'Electricity and Magnetism'],
    ['phys_optics', 'Optics'],
    ['phys_acoustics', 'Acoustics'],
    ['phys_modern_physics', 'Modern Physics'],
    ['phys_nuclear_and_particle_physics', 'Nuclear and Particle Physics'],
    ['phys_math_methods_and_pedagogy', 'Math Methods and Pedagogy'],
    ['phys_ancillary_materials', 'Ancillary Materials'],
    ['socsci_anthropology', 'Anthropology'],
    ['socsci_communication_studies', 'Communication Studies'],
    ['socsci_counseling_and_guidance', 'Counseling & Guidance'],
    ['socsci_economics', 'Economics'],
    ['socsci_early_childhood_education', 'Early Childhood Education'],
    ['socsci_education_and_professional_development', 'Education and Professional Development'],
    ['socsci_geography_human', 'Geography (Human)'],
    ['socsci_human_development', 'Human Development'],
    ['socsci_political_science_and_civics', 'Political Science and Civics'],
    ['socsci_psychology', 'Psychology'],
    ['socsci_social_work', 'Social Work'],
    ['socsci_sociology', 'Sociology'],
    ['socsci_ancillary_materials', 'Ancillary Materials'],
    ['stat_introductory_statistics', 'Introductory Statistics'],
    ['stat_probability_theory', 'Probability Theory'],
    ['stat_computing_and_modeling', 'Computing and Modeling'],
    ['stat_applied_statistics', 'Applied Statistics'],
    ['stat_ancillary_materials', 'Ancillary Materials'],
    ['work_allied_health', 'Allied Health'],
    ['work_arts_audio_visual_technology_and_communications', 'Arts, Audio/Visual Technology, and Communications'],
    ['work_construction', 'Construction'],
    ['work_electronics_technology', 'Electronics Technology'],
    ['work_hospitality', 'Hospitality'],
    ['work_hvac_and_power_plant_operations', 'HVAC and Power Plant Operations'],
    ['work_information_technology', 'Information Technology'],
    ['work_manufacturing', 'Manufacturing'],
    ['work_water_systems_technology', 'Water Systems Technology']
]);

const getShelfOptions = (rawName) => {
    var shelfOption;
    var disableShelf = false;
    switch(rawName) {
        case 'biology':
            shelfOption = biologyOptions;
            break;
        case 'business':
            shelfOption = businessOptions;
            break;
        case 'chemistry':
            shelfOption = chemistryOptions;
            break;
        case 'engineering':
            shelfOption = engineeringOptions;
            break;
        case 'espanol':
            shelfOption = espanolOptions;
            break;
        case 'geosciences':
            shelfOption = geosciencesOptions;
            break;
        case 'humanities':
            shelfOption = humanitiesOptions;
            break;
        case 'mathematics':
            shelfOption = mathematicsOptions;
            break;
        case 'medicine':
            shelfOption = medicineOptions;
            break;
        case 'physics':
            shelfOption = physicsOptions;
            break;
        case 'social_science':
            shelfOption = socialScienceOptions;
            break;
        case 'statistics':
            shelfOption = statisticsOptions;
            break;
        case 'workforce':
            shelfOption = workforceOptions;
            break;
        default:
            shelfOption = [];
            disableShelf = true;
    }
    return [shelfOption, disableShelf];
};

const getLicenseText = (license) => {
    if (license !== '') {
        let foundLicense = licenseOptions.find((item) => {
            return item.value === license;
        });
        if (foundLicense !== undefined) {
            return foundLicense.text;
        } else {
            return 'Unknown license';
        }

    } else {
        return 'Not specified';
    }
};

const getGlyphAddress = (library) => {
    switch (library) {
        case 'chemistry':
            return '/glyphs/chem.png';
        case 'engineering':
            return '/glyphs/eng.png';
        case 'mathematics':
            return '/glyphs/math.png';
        case 'social_science':
            return '/glyphs/socialsci.png';
        case 'workforce':
            return '/glyphs/workforce.png';
        default:
            return '/favicon-32x32.png';
    }
};

const getLibraryName = (library) => {
    switch (library) {
        case 'biology':
            return "Biology";
        case 'business':
            return "Business";
        case 'chemistry':
            return "Chemistry";
        case 'engineering':
            return "Engineering";
        case 'espanol':
            return "Español";
        case 'geosciences':
            return "Geosciences";
        case 'humanities':
            return "Humanities";
        case 'mathematics':
            return "Mathematics";
        case 'medicine':
            return "Medicine";
        case 'physics':
            return "Physics";
        case 'social_science':
            return "Social Science";
        case 'statistics':
            return "Statistics";
        case 'workforce':
            return "Workforce";
        default:
            return "Unknown";
    }
};

const getTextUse = (use) => {
    if (use !== '') {
        let foundUse = textUseOptions.find((item) => {
            return item.value === use;
        });
        return foundUse.text;
    } else {
        return '';
    }
};

export {
    licenseOptions,
    textUseOptions,
    libraryOptions,
    biologyOptions,
    businessOptions,
    chemistryOptions,
    engineeringOptions,
    espanolOptions,
    geosciencesOptions,
    humanitiesOptions,
    mathematicsOptions,
    medicineOptions,
    physicsOptions,
    socialScienceOptions,
    statisticsOptions,
    workforceOptions,
    typeOptions,
    statusOptions,
    allShelfOptions,
    allShelfMap,
    getShelfOptions,
    getLicenseText,
    getGlyphAddress,
    getLibraryName,
    getTextUse
}

/*
LIBRARIES
Biology
Business
Chemistry
Engineering
Español
Geosciences
Humanities
Mathematics
Medicine
Physics
Social Science
Statistics
Workforce
*/
