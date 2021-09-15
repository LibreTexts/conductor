//
// LibreTexts Conductor
// tag.js
// Mongoose Model
//

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TagSchema = new Schema({
    orgID: String,          // organization identifier string,
    tagID: String,          // base62 12-digit identifier
    tagTitle: String        // the tag's title/display text
}, {
    timestamps: true
});

const Tag = mongoose.model('Tag', TagSchema);

module.exports = Tag;
