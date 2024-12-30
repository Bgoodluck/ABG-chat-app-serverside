const mongoose = require("mongoose")


const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "user"
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "user"
    },
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "conversation"
    },
    text: {
        type: String,
        default: ""
    },
    imageUrl: {
        type: String,
        default: ""
    },
    videoUrl: {
        type: String,
        default: ""
    },
    msgByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    status: [{
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user'
        },
        delivered: {
            type: Date,
            default: null
        },
        seen: {
            type: Date,
            default: null
        }
    }],
    seen: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});


const messageModel = mongoose.models.messageModel || mongoose.model("message", messageSchema)

module.exports = messageModel;