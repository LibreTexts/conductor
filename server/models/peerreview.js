//
// LibreTexts Conductor
// peerreview.js
// Mongoose Model
//

import mongoose from 'mongoose';
import { peerReviewAuthorTypes } from '../util/peerreviewutils.js';

const PeerReviewSchema = new mongoose.Schema({
    projectID: {                    // the Project the Peer Review submission is for
        type: String,
        required: true
    },
    peerReviewID: {                 // base62 9-digit identifier
        type: String,
        required: true
    },
    rubricID: {                     // the identifier of the Rubric the review was based on
        type: String,
        required: true
    },
    rubricTitle: {                  // the title of the Rubric the review was based on
        type: String,
        required: true
    },
    author: {                       // UUID or name (if non-Conductor-user) of the submitter
        type: String,
        required: true
    },
    authorEmail: String,            // submitter's email (only if 'anonymous')
    anonAuthor: {                   // If the submitter is a Conductor user (false) or 'anonymous' (true)
        type: Boolean,
        default: false
    },
    authorType: {                   // the submitter's role/type
        type: String,
        enum: peerReviewAuthorTypes,
        required: true
    },
    rating: {                       // the resource's overall quality, rated on a scale of 0-5
        type: Number,
        min: 0,
        max: 5
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
    textBlocks: [{                  // text blocks for instructions/more details
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
    responses: [{                   // forms prompts/question responses
        promptType: {               // the prompt type, e.g.: ['3-likert', '5-likert', '7-likert', 'text', 'dropdown']
            type: String,
            required: true
        },
        promptText: {               // the prompt instructions/text, in simple Markdown
            type: String,
            required: true
        },
        promptRequired: {           // indicates answering the prompt was required to submit the review
            type: Boolean,
            default: false
        },
        likertResponse: {           // if the prompt is a Likert scale, the response radio number (1-[3,5,7] for [3,5,7]-point scale)
            type: Number,
            min: 1,
            max: 7
        },
        textResponse: String,
        dropdownResponse: String,
        checkboxResponse: {
            type: Boolean,
            default: false
        },
        promptOptions: [{           // dropdown option entries, if the prompt is of promptType 'dropdown'
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

const PeerReview = mongoose.model('PeerReview', PeerReviewSchema);

export default PeerReview;
