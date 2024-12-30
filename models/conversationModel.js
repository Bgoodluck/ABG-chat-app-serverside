const mongoose = require("mongoose");


const conversationSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "user"
    },

    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "user"
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        // required: true,
        ref: "user"
    }],
    isGroup: {
        type: Boolean,
        default: false
    },
    groupName: {
        type: String,
        required: function() { return this.isGroup; }
    },
    groupAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: function() { return this.isGroup; }
    },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "message"
    },

    messages: [
        {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "message"
        }
    ],
},{
    timestamps: true,
})

const conversationModel = mongoose.models.conversationModel || mongoose.model("conversation", conversationSchema)

module.exports = conversationModel;