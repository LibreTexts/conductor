//
// LibreTexts Conductor
// book.js
// Mongoose Model
//

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BookSchema = new Schema({
    bookID: {                   // the LibreTexts standard text identifier of format `libShort-coverPageID`
        type: String,
        required: true
    },
    title: {                    // the full book title
        type: String,
        required: true
    },
    author: {                   // the book author
        type: String,
        required: true
    },
    library: {                  // the book library (standard LibreTexts shortened format)
        type: String,
        required: true
    },
    shelf: String,              // the book's shelf
    license: String,            // the book license
    link: String,               // the URL to access the book on the live libraries
    institution: String,        // the ORIGIN institution (via Libraries import)
    commons: [String]           // list of Campus Commons to include Book in
}, {
    timestamps: true
});

const Book = mongoose.model('Book', BookSchema);

module.exports = Book;
