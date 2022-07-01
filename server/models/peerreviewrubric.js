//
// LibreTexts Conductor
// peerreviewrubric.js
// Mongoose Model
//

import mongoose from 'mongoose';

const PeerReviewRubricSchema = new mongoose.Schema({
    orgID: {                        // the organization the rubric was created in
        type: String,
        required: true
    },
    rubricID: {                     // organization identifier OR base62 7-digit identifier
        type: String,
        required: true,
        unique: true
    },
    isOrgDefault: {                 // indicates the Rubric is an Organization's default Rubric
        type: Boolean,
        default: false
    },
    rubricTitle: {                  // the Rubric title, if not an Organization default
        type: String,
        required: true
    },
    headings: [{                    // form sub-headings or "sections"
        text: {
            type: String,
            required: true
        },
        order: {                    // the position of the heading within the form (ascending, starting at 1)
            type: Number,
            required: true,
            min: 1
        }
    }],
    textBlocks: [{                  // text blocks for instructions/more details (simple Markdown)
        text: {
            type: String,
            required: true
        },
        order: {                    // the position of the heading within the form (ascending, starting at 1)
            type: Number,
            required: true,
            min: 1
        }
    }],
    prompts: [{                     // forms prompts/question
        promptType: {               // the prompt type, one of: ['3-likert', '5-likert', '7-likert', 'text', 'dropdown', 'checkbox']
            type: String,
            required: true
        },
        promptText: {               // the prompt instructions/text, in simple Markdown
            type: String,
            required: true
        },
        promptRequired: {           // whether answering the prompt is required to submit the review
            type: Boolean,
            default: false
        },
        promptOptions: [{           // dropdown option entries (up to 10), if the prompt is of promptType 'dropdown'
            key: String,
            value: String,
            text: String
        }],
        order: {                    // the position of the prompt within the form (ascending, starting at 1)
            type: Number,
            required: true,
            min: 1
        }
    }]
}, {
    timestamps: true
});

const PeerReviewRubric = mongoose.model('PeerReviewRubric', PeerReviewRubricSchema);

export default PeerReviewRubric;
