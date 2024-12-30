const conversationModel = require('../models/conversationModel');
const messageModel = require('../models/messageModel');
const mongoose = require('mongoose');
const getUserDetailsFromToken = require('../helpers/getUserDetailsFromToken');

exports.createOrGetConversation = async (req, res) => {
    try {
        const { participantId } = req.body;
        const token = req.headers['auth-token'] || req.headers['token'];
        
        // Get user from token
        const user = await getUserDetailsFromToken(token);
        if (!user) {
            return res.status(401).json({ error: 'Authentication failed' });
        }

        // Check if conversation already exists
        let conversation = await conversationModel.findOne({
            participants: { 
                $all: [user._id, participantId],
                $size: 2 
            },
            isGroup: false
        }).populate('participants', 'firstName lastName picture email');

        if (!conversation) {
            // Create new conversation
            conversation = await conversationModel.create({
                participants: [user._id, participantId],
                isGroup: false
            });
            
            conversation = await conversation.populate('participants', 'firstName lastName picture email');
        }

        res.status(200).json(conversation);
    } catch (error) {
        console.error('Create conversation error:', error);
        res.status(500).json({ error: 'Failed to create conversation' });
    }
};

exports.getUserConversations = async (req, res) => {
    try {
        const token = req.headers['auth-token'] || req.headers['token'];
        const user = await getUserDetailsFromToken(token);
        
        if (!user) {
            return res.status(401).json({ error: 'Authentication failed' });
        }

        const conversations = await conversationModel.find({
            participants: user._id
        })
        .populate('participants', 'firstName lastName picture email')
        .populate('lastMessage')
        .sort({ updatedAt: -1 });

        res.status(200).json(conversations);
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Failed to get conversations' });
    }
};

exports.getConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const token = req.headers['auth-token'] || req.headers['token'];
        const user = await getUserDetailsFromToken(token);
        
        if (!user) {
            return res.status(401).json({ error: 'Authentication failed' });
        }

        const conversation = await conversationModel.findById(conversationId)
            .populate('participants', 'firstName lastName picture email')
            .populate('lastMessage');

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Verify user is a participant
        if (!conversation.participants.some(p => p._id.toString() === user._id.toString())) {
            return res.status(403).json({ error: 'Not authorized to access this conversation' });
        }

        res.status(200).json(conversation);
    } catch (error) {
        console.error('Get conversation error:', error);
        res.status(500).json({ error: 'Failed to get conversation' });
    }
};

exports.deleteConversation = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { conversationId } = req.params;
        const token = req.headers['auth-token'] || req.headers['token'];
        const user = await getUserDetailsFromToken(token);
        
        if (!user) {
            return res.status(401).json({ error: 'Authentication failed' });
        }

        const conversation = await conversationModel.findById(conversationId);
        
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Check if user is participant
        if (!conversation.participants.includes(user._id)) {
            return res.status(403).json({ error: 'Not authorized to delete this conversation' });
        }

        // Delete all messages in the conversation
        await messageModel.deleteMany({ conversationId }, { session });
        
        // Delete the conversation
        await conversationModel.findByIdAndDelete(conversationId, { session });

        await session.commitTransaction();
        res.status(200).json({ message: 'Conversation deleted successfully' });
    } catch (error) {
        await session.abortTransaction();
        console.error('Delete conversation error:', error);
        res.status(500).json({ error: 'Failed to delete conversation' });
    } finally {
        session.endSession();
    }
};