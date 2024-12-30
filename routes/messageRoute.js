const express = require("express");
const messageController = require("../controller/messageController");



const router = express.Router();



router.get('/:conversationId', messageController.getMessage);
router.post('/send', messageController.sendMessage);
router.get('/conversation/:conversationId', messageController.getMessages);
router.patch('/:messageId', messageController.updateMessage);
router.delete('/:messageId', messageController.deleteMessage);

// Message status routes
router.post('/:conversationId/deliver', messageController.markDelivered);
router.post('/:conversationId/seen', messageController.markSeen);
router.get('/status/:messageId', messageController.getMessageStatus);





module.exports = router