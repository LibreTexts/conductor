const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    uuid: {
        type: String,
        required: true
    },
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    avatar: String,
    hash: String,
    salt: String,
    roles: [{
        org: String,
        role: String
    }]
}, {
    timestamps: true
});

const User = mongoose.model('User', UserSchema);

module.exports = User;
