const express = require('express');
const conversationController = require('../controller/conversationController');



const router = express.Router();

// Conversation routes without auth middleware
router.post('/create', conversationController.createOrGetConversation);
router.get('/user', conversationController.getUserConversations);
router.get('/:conversationId', conversationController.getConversation);
router.delete('/:conversationId', conversationController.deleteConversation);

module.exports = router;