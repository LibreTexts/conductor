//
// LibreTexts Conductor
// RoadmapOptions.jsx
//

const roadmapStepsSimple = [
    { name: '1',    text: 'Vision (1)' },
    { name: '2',    text: 'Accounts (2)' },
    { name: '3',    text: 'Training (3)' },
    { name: '4',    text: 'Step 4' },
    { name: '5a',   text: 'Scan (5a)' },
    { name: '5b',   text: 'Mapping (5b)' },
    { name: '5c',   text: 'Remixing (5c)' },
    { name: '6',    text: 'Skeleton (6)' },
    { name: '7',    text: 'Constructing (7)' },
    { name: '8',    text: 'Editing (8)' },
    { name: '9',    text: 'Advanced (9)' },
    { name: '10',   text: 'Accessibility (10)' },
    { name: '11',   text: 'Publishing (11)' },
    { name: '12',   text: 'Curating (12)' }
];

const roadmapSteps = [
    {
        key: '1',
        title: 'Step 1',
        name: 'Vision',
        description: (
            <div>
                <p><strong>Construct a vision of your book.</strong></p>
                <p>Are you creating a new book from all original content, or looking to edit/adapt/remix existing content into a new OER? Either way, LibreTexts has what you need to get started: an easy to use WYSIWYG interface for editing, personal sandboxes to help keep track of your work, our state of the art Remixer for mixing existing and new content together, and more.</p>
            </div>
        ),
        hasExtra: true,
        linkHref: 'https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/02%3A_A_Framework_for_Designing_Online_Texts',
        linkTitle: 'Designing Online Texts'
    }, {
        key: '2',
        title: 'Step 2',
        name: 'Accounts',
        description: (
            <div>
                <p><strong>Obtain Proper LibreTexts Accounts.</strong></p>
                <p>In order to get started with LibreTexts, you first need to create a free instructor account by filling out the form below.</p>
            </div>
        ),
        hasExtra: true,
        linkHref: 'https://register.libretexts.org/',
        linkTitle: 'Register at LibreTexts'
    }, {
        key: '3',
        title: 'Step 3',
        name: 'Training',
        description: (
            <div>
                <p><strong>Review remixing and editing fundamentals.</strong></p>
                <p>We have put together a comprehensive construction guide for easy reference as you get started creating your OER on the LibreTexts platform. <a href='https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/07%3A_Remixing_Existing_Content' target='_blank' rel='noopener noreferrer'>Chapter 7</a> of the construction guide covers what you need to know to get started with our Remixer. <a href='https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/03%3A_Basic_Editing' target='_blank' rel='noopener noreferrer'>Chapter 3</a> covers basic editing.</p>
            </div>
        ),
        hasExtra: false,
        linkHref: 'https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/03%3A_Basic_Editing',
        linkTitle: 'Basic Editing'
    }, {
        key: '4',
        title: 'Step 4',
        name: '',
        description: (
            <div>
                <p>Does your Vision require remixing of existing content?</p>
            </div>
        ),
        hasExtra: true,
        linkHref: 'https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/07%3A_Remixing_Existing_Content',
        linkTitle: 'Remixing Existing Content'
    }, {
        key: '5a',
        title: 'Step 5a',
        name: 'Scan',
        description: (
            <div>
                <p><strong>Review & evaluate existing content on LibreTexts and identify gaps.</strong></p>
                <p>LibreTexts is divided into 14 discipline specific libraries of content. In order to determine whether or not OER on your topic already exists you can search within one of these libraries. If you know something exists but cannot find it in LibreTexts, please let us know by filling out one of our <a href='https://harvest.libretexts.org' target='_blank' rel='noopener noreferrer'>Harvest Request</a> forms and we will be happy to import the content for you to use in your project.</p>
            </div>
        ),
        hasExtra: false,
        linkHref: '',
        linkTitle: ''
    }, {
        key: '5b',
        title: 'Step 5b',
        name: 'Mapping',
        description: (
            <div>
                <p><strong>Build a remixing map.</strong></p>
                <p>We recommend you begin creating your OER on LibreTexts by creating what we call a remixing map. A remixing map can be created using any software you prefer, but should include all of the existing OER you plan to use in your project as well as the order in which it should be used. You can see a sample remixing map in the construction guide <a href='https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/07%3A_Remixing_Existing_Content/7.02%3A_Building_Remixing_Maps' target='_blank' rel='noopener noreferrer'>here</a>. Building a map before you begin remixing will save you time as you will have all of your resources listed out in order and will be better able to find them quickly in the Remixer.</p>
            </div>
        ),
        hasExtra: false,
        linkHref: 'https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/07%3A_Remixing_Existing_Content/7.02%3A_Building_Remixing_Maps',
        linkTitle: 'Building Remixing Maps'
    }, {
        key: '5c',
        title: 'Step 5c',
        name: 'Remixing',
        description: (
            <div>
                <p><strong>Build Remix using Map and Remixer (blank pages for gaps) in sandbox.</strong></p>
                <p>Your remix map will help guide you through selecting your chosen resources within the remixer. The <a href='https://chem.libretexts.org/Under_Construction/Development_Details/OER_Remixer' target='_blank' rel='noopener noreferrer'>Remixer</a> consists of two panels and utilizes an easy drag and drop process to create new OER. Simply select one of the libraries in the Library Panel on the left hand side of the Remixer and navigate to the resource you need in either the Campus Bookshelves, Bookshelves, or Learning Objects section of your chosen library. You can then use the plus signs to expand the list of items as you go. Once you have found what you’re looking for, drag it to the Remix Panel in whatever order you have determined on your remix map. The Remixer will automatically renumber your chapters, sections, and pages as you go. You may insert blank pages as page holders for creating new content by clicking on the plus sign for New Page in the gray menu bar. Once your remix is ready to upload to your sandbox, you can click on the green Save to Server button. You can continue to work on your OER from your sandbox once it has been uploaded from the Remixer. </p>
            </div>
        ),
        hasExtra: true,
        linkHref: 'https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/07%3A_Remixing_Existing_Content/7.03%3A_How_to_Make_a_LibreTexts_Remix',
        linkTitle: 'Remixer Tutorial'
    }, {
        key: '6',
        title: 'Step 6',
        name: 'Skeleton',
        description: (
            <div>
                <p><strong>Build initial empty text skeleton (i.e. empty pages) using the Remixer in your sandbox.</strong></p>
                <p>If your vision does not include remixing existing OER to create a new resource, and instead you wish to start building from scratch, you can build an empty text skeleton in the <a href='https://chem.libretexts.org/Under_Construction/Development_Details/OER_Remixer' target='_blank' rel='noopener noreferrer'>Remixer</a> and upload it to your sandbox for easier editing.</p>
            </div>
        ),
        hasExtra: true,
        linkHref: 'https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/07%3A_Remixing_Existing_Content/7.03%3A_How_to_Make_a_LibreTexts_Remix',
        linkTitle: 'Remixer Tutorial'
    }, {
        key: '7',
        title: 'Step 7',
        name: 'Constructing',
        description: (
            <div>
                <p><strong>Fill in gaps with pre-existing OER content or construct content directly.</strong></p>
                <p>Once you have saved either your remix or an empty text skeleton to your sandbox, you can begin editing your content by filling in any gaps with either new or existing content.</p>
            </div>
        ),
        hasExtra: true,
        linkHref: 'https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/03%3A_Basic_Editing',
        linkTitle: 'Basic Editing'
    }, {
        key: '8',
        title: 'Step 8',
        name: 'Editing',
        description: (
            <div>
                <p><strong>Edit pages to fit faculty/class needs (may require forking of remixed content).</strong></p>
                <p>You can edit any chapter, section, or page in your text by clicking on the Edit button from the black menu bar after you have navigated to the content you wish to edit; this will open the content in an HTML editor where you can add or remove content. You may need to fork content in your remix as you edit. Forking means to make a copy of the original content by severing the connection to the original source; when you form content your copy of the content will no longer be automatically updated when the original source is updated. To fork content click on the blue Y shaped icon next to the title; a pop up will appear asking if you’d like to fork the content. Additional information on forking can be found in <a href='https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/04%3A_Advanced_Editing/4.02%3A_Forking_a_Transcluded_(Reused)_Page' target='_blank' rel='noopener noreferrer'>Chapter 4</a> of the Construction Guide. </p>
            </div>
        ),
        hasExtra: false,
        linkHref: '',
        linkTitle: ''
    }, {
        key: '9',
        title: 'Step 9',
        name: 'Advanced',
        description: (
            <div>
                <p><strong>Work up advanced features (autograded assessments, visualizations, simulations, interactive graphs, etc.).</strong></p>
                <p>Additional information on advanced features can be found in <a href='https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/05%3A_Interactive_Elements' target='_blank' rel='noopener noreferrer'>Chapter 5</a> of the Construction Guide.</p>
            </div>
        ),
        hasExtra: false,
        linkHref: 'https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/04%3A_Advanced_Editing',
        linkTitle: 'Advanced Editing',
        optional: true
    }, {
        key: '10',
        title: 'Step 10',
        name: 'Accessibility',
        description: (
            <div>
                <p><strong>Request a preliminary accessibility check (Bradbot or A11Y bot).</strong></p>
                <p>LibreTexts has two bots developed specifically to ensure all of our content meets accessibility requirements. Once your text is complete we will run it through our Bradbot and A11Y bot to identify and correct any accessibility compliance issues.</p>
            </div>
        ),
        hasExtra: false,
        linkHref: '',
        linkTitle: ''
    }, {
        key: '11',
        title: 'Step 11',
        name: 'Publishing',
        description: (
            <div>
                <p><strong>Request 'publishing' of text.</strong></p>
                <p>Once you deem your text is ready to be published, contact us <a href='mailto:info@libretexts.org' target='_blank' rel='noopener noreferrer'>(info@libretexts.org)</a> or use the button in Important Tools on the project homepage and we will prepare it for publication on the Campus Bookshelves. Before publishing a text, it goes through an external review of its organization in order to ensure it complies with the standard organization present in all LibreTexts resources. It will also undergo a remixer check, and be checked by our Bradbot accessibility bot to ensure it meets current accessibility standards. Once these steps are complete, the text will be moved to your Campus Bookshelf where it can be compiled for PDF, LMS, or (print) bookstore export.</p>
            </div>
        ),
        hasExtra: false,
        linkHref: '',
        linkTitle: ''
    }, {
        key: '12',
        title: 'Step 12',
        name: 'Curating',
        description: (
            <div>
                <p><strong>Curate text (edit, polish, and hone) in campus bookshelf.</strong></p>
                <p>LibreTexts are never considered finished as none of our resources are considered static. Rather, once a text has been published to one of the Campus Bookshelves it can then be curated, or edited, polished, and honed.</p>
            </div>
        ),
        hasExtra: false,
        linkHref: '',
        linkTitle: ''
    }
];


/**
 * Accepts an internal Project Construction Roadmap step name and attempts to
 * return the UI-ready string representation.
 * @param {String} step  - the step name to find UI text for
 * @returns {String} the UI-ready string representation
 */
const getRoadmapStepName = (step) => {
    let foundStep = roadmapSteps.find(item => item.key === step);
    if (foundStep !== undefined) {
        return foundStep.name;
    } else {
        return 'Unknown Step';
    }
};

export {
    roadmapSteps,
    getRoadmapStepName
}
