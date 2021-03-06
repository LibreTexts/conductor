//
// LibreTexts Conductor
// translationfeedback.js
// Mongoose Model
//

import mongoose from 'mongoose';

const TranslationFeedbackSchema = new mongoose.Schema({
    language: {                         // the target translation lanuage
        type: String,
        required: true
    },
    accurate: {                         // true if machine translation was accurate, false otherwise
        type: Boolean,
        required: true
    },
    page: {                             // the URL of the translated page
        type: String,
        required: true
    },
    feedback: [{                        // array of incorrect terms and their correct translation
        incorrect: String,
        corrected: String
    }]
}, {
    timestamps: true
});

const TranslationFeedback = mongoose.model('TranslationFeedback', TranslationFeedbackSchema);

export default TranslationFeedback;
