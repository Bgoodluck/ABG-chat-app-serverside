const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, "provide firstName"]
    },

    lastName: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: [true, "provide email"],
        unique: true
    },

    password: {
        type: String,
        required: [true, "provide password"]
    },

    picture: {
        type: String,
        default: ""
    },
    socialProfiles: {
        type: Array,
        default: []
    }  ,
    statusMessage: {
        type: String,
        default: ""
    },
    phone: {
        type: String,
        default: ""
    }

}, {
    timestamps: true
})

const userModel = mongoose.models.userModel || mongoose.model("user", userSchema)

module.exports = userModel