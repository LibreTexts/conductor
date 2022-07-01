//
// LibreTexts Conductor
// tag.js
// Mongoose Model
//

import mongoose from 'mongoose';

const TagSchema = new mongoose.Schema({
    orgID: String,          // organization identifier string,
    tagID: String,          // base62 12-digit identifier
    title: String           // the tag's title/display text
}, {
    timestamps: true
});

const Tag = mongoose.model('Tag', TagSchema);

export default Tag;
