const conversationModel = require("../models/conversationModel");
const messageModel = require("../models/messageModel");




exports.getMessage = async(req, res)=>{
    try {
        const messages = await messageModel.find({
            conversationId: req.params.conversationId
        })
        .populate('sender', 'firstName lastName picture')
        .sort({ createdAt: -1 })
        .limit(50);
        
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load messages' });
    }
}


exports.sendMessage = async (req, res) => {
    try {
        const { conversationId, text, imageUrl, videoUrl } = req.body;
        const sender = req.user._id;

        const conversation = await conversationModel.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Create message
        const newMessage = await messageModel.create({
            sender,
            conversationId,
            text: text || '',
            imageUrl: imageUrl || '',
            videoUrl: videoUrl || ''
        });

        // Update conversation's lastMessage
        conversation.lastMessage = newMessage._id;
        await conversation.save();

        // Populate sender details
        await newMessage.populate('sender', 'firstName lastName picture');

        res.status(201).json(newMessage);
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
},

// Get messages for a conversation
exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const messages = await messageModel.find({ conversationId })
            .populate('sender', 'firstName lastName picture')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await messageModel.countDocuments({ conversationId });

        res.status(200).json({
            messages,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
},

// Update message (edit)
exports.updateMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { text } = req.body;
        const userId = req.user._id;

        const message = await messageModel.findById(messageId);
        
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user is the sender
        if (message.sender.toString() !== userId.toString()) {
            return res.status(403).json({ error: 'Not authorized to edit this message' });
        }

        // Only allow editing text content
        message.text = text;
        await message.save();

        await message.populate('sender', 'firstName lastName picture');

        res.status(200).json(message);
    } catch (error) {
        console.error('Update message error:', error);
        res.status(500).json({ error: 'Failed to update message' });
    }
},

// Delete message
exports.deleteMessage =async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await messageModel.findById(messageId);
        
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user is the sender
        if (message.sender.toString() !== userId.toString()) {
            return res.status(403).json({ error: 'Not authorized to delete this message' });
        }

        await message.deleteOne();

        // Update conversation's lastMessage if needed
        const conversation = await conversationModel.findById(message.conversationId);
        if (conversation.lastMessage?.toString() === messageId) {
            const lastMessage = await messageModel.findOne({ conversationId: message.conversationId })
                .sort({ createdAt: -1 });
            
            conversation.lastMessage = lastMessage?._id || null;
            await conversation.save();
        }

        res.status(200).json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
}


exports.markDelivered = async (req, res) => {
    try {
        const userId = req.user._id;
        const { conversationId } = req.params;

        // Find all undelivered messages in the conversation for this user
        const messages = await messageModel.find({
            conversationId,
            sender: { $ne: userId },
            'status.recipient': userId,
            'status.delivered': null
        });

        // Update delivery status for all found messages
        await Promise.all(messages.map(async (message) => {
            const statusIndex = message.status.findIndex(
                s => s.recipient.toString() === userId.toString()
            );
            
            if (statusIndex !== -1) {
                message.status[statusIndex].delivered = new Date();
                await message.save();
            }
        }));

        res.status(200).json({ message: 'Messages marked as delivered' });
    } catch (error) {
        console.error('Mark delivered error:', error);
        res.status(500).json({ error: 'Failed to mark messages as delivered' });
    }
},

// Mark messages as seen
exports.markSeen = async (req, res) => {
    try {
        const userId = req.user._id;
        const { conversationId } = req.params;

        // Find all unseen messages in the conversation for this user
        const messages = await messageModel.find({
            conversationId,
            sender: { $ne: userId },
            'status.recipient': userId,
            'status.seen': null
        });

        // Update seen status for all found messages
        await Promise.all(messages.map(async (message) => {
            const statusIndex = message.status.findIndex(
                s => s.recipient.toString() === userId.toString()
            );
            
            if (statusIndex !== -1) {
                message.status[statusIndex].seen = new Date();
                await message.save();
            }
        }));

        res.status(200).json({ message: 'Messages marked as seen' });
    } catch (error) {
        console.error('Mark seen error:', error);
        res.status(500).json({ error: 'Failed to mark messages as seen' });
    }
},

// Enhanced send message to include status initialization
exports.sendMessage = async (req, res) => {
    try {
        const { conversationId, text, imageUrl, videoUrl } = req.body;
        const sender = req.user._id;

        const conversation = await conversationModel.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Initialize status for all recipients
        const status = conversation.participants
            .filter(p => p.toString() !== sender.toString())
            .map(recipient => ({
                recipient,
                delivered: null,
                seen: null
            }));

        // Create message with status
        const newMessage = await messageModel.create({
            sender,
            conversationId,
            text: text || '',
            imageUrl: imageUrl || '',
            videoUrl: videoUrl || '',
            status
        });

        // Update conversation's lastMessage
        conversation.lastMessage = newMessage._id;
        await conversation.save();

        await newMessage.populate('sender', 'firstName lastName picture');
        await newMessage.populate('status.recipient', 'firstName lastName picture');

        res.status(201).json(newMessage);
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
},

// Get message status
exports.getMessageStatus = async (req, res) => {
    try {
        const { messageId } = req.params;
        
        const message = await messageModel.findById(messageId)
            .populate('status.recipient', 'firstName lastName picture');

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        res.status(200).json(message.status);
    } catch (error) {
        console.error('Get message status error:', error);
        res.status(500).json({ error: 'Failed to get message status' });
    }
}