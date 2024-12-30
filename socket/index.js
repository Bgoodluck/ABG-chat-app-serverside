const express = require("express");
const { Server } = require("socket.io");
const http = require("http");
const getUserDetailsFromToken = require("../helpers/getUserDetailsFromToken");
const userModel = require("../models/userModel");
const messageModel = require("../models/messageModel");
const conversationModel = require("../models/conversationModel");

const app = express();
const server = http.createServer(app);
// const io = new Server(server, {
//   cors: {
//     origin: process.env.FRONTEND_URL,
//     allowedHeaders: ["Content-Type", "Authorization", "auth-token", "token"],
//     methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
//     credentials: true,
//   },
//   pingTimeout: 60000,
//   reconnection: true,
//   reconnectionAttempts: 5,
//   pingInterval: 25000, // Add ping interval for better connection monitoring
// });


// server.js update
const io = new Server(server, {
  cors: {
    origin: "https://abg-chat-app-clientside.vercel.app" || process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  path: '/socket.io/',
  connectTimeout: 45000,
});

// Add global error handler
io.engine.on("connection_error", (err) => {
  console.log('Connection error:', err);
});


// Store online users with their socket IDs and additional data
const onlineUsers = new Map();




const broadcastOnlineUsers = () => {
  const onlineUsersList = Array.from(onlineUsers.values()).map((u) => ({
    _id: u.userData._id,
    firstName: u.userData.firstName,
    lastName: u.userData.lastName,
    picture: u.userData.picture,
  }));
  io.emit("onlineUsers", onlineUsersList);
};





// Helper function to handle user disconnection
const handleUserDisconnection = (userId) => {
  if (userId && onlineUsers.has(userId)) {
    onlineUsers.delete(userId);
    broadcastOnlineUsers();
  }
};





io.on("connection", async (socket) => {
  try {
    console.log("New client connected", socket.id);

    const token = socket.handshake.auth.token;
    if (!token) {
      socket.disconnect();
      return;
    }

    // Get user details from token
    const user = await getUserDetailsFromToken(token);
    if (!user) {
      socket.disconnect();
      return;
    }

    // Handle case where user connects from another device/browser
    const existingConnection = onlineUsers.get(user._id);
    if (existingConnection && existingConnection.socketId !== socket.id) {
      // Optionally emit event to existing connection
      io.to(existingConnection.socketId).emit("newSessionConnected");
    }

    // Add user to online users
    onlineUsers.set(user._id, {
      socketId: socket.id,
      userData: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        picture: user.picture,
        lastActive: new Date().toISOString(),
      },
      rooms: [user._id], // Track rooms user has joined
    });

    // Join personal room
    socket.join(user._id);

    // Broadcast updated online users list
    broadcastOnlineUsers();





    // Handle message page user details request
    socket.on("get-user-details", async (userId) => {
      try {
        const userDetails = await userModel
          .findById(userId)
          .select("-password");
        if (!userDetails) {
          socket.emit("user-details-error", "User not found");
          return;
        }

        // Check if user is in onlineUsers Map
        const isOnline = onlineUsers.has(userId.toString());

        const payload = {
          userId: userDetails._id,
          firstName: userDetails.firstName,
          lastName: userDetails.lastName,
          picture: userDetails.picture,
          email: userDetails.email,
          phone: userDetails.phone,
          statusMessage: userDetails.statusMessage,
          socialProfiles: userDetails.socialProfiles,
          online: isOnline,
        };

        socket.emit("user-details", payload);
        broadcastOnlineUsers(); // Broadcast updated online status
      } catch (error) {
        socket.emit("user-details-error", "Error fetching user details");
      }
    });




    // Handle message sending
    socket.on("send-message", async (data) => {
      try {
        const { receiverId, text, imageUrl, videoUrl, msgByUserId, sender } =
          data;

        // Create a unique conversation ID that's consistent regardless of sender/receiver order
        const participantIds = [sender, receiverId].sort();
        const conversationId = participantIds.join("-");

        // Find or create conversation
        let conversation = await conversationModel.findOne({
          participants: { $all: [sender, receiverId] },
          isGroup: false,
        });

        if (!conversation) {
          conversation = await conversationModel.create({
            participants: [sender, receiverId],
            sender: sender,
            recipient: receiverId,
            isGroup: false,
            messages: [],
          });
        }

        const savedMessage = await messageModel.create({
          sender: sender,
          receiver: receiverId,
          conversationId: conversation._id,
          text,
          imageUrl,
          videoUrl,
          status: [
            {
              recipient: receiverId,
              delivered: null,
              seen: null,
            },
          ],
          msgByUserId,
          timestamp: new Date(),
        });

        // Update conversation
        conversation.lastMessage = savedMessage._id;
        conversation.messages.push(savedMessage._id);
        await conversation.save();

        // Get the receiver's socket
        const receiverSocket = Array.from(onlineUsers.values()).find(
          (u) => u.userData._id.toString() === receiverId
        );

        // Emit to receiver if online
        if (receiverSocket) {
          io.to(receiverSocket.socketId).emit("new-message", {
            message: {
              ...savedMessage.toObject(),
              sender: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                picture: user.picture,
              },
            },
            conversation: conversation._id,
          });
        }

        // Emit confirmation to sender
        socket.emit("message-sent", {
          message: savedMessage,
          conversation: conversation._id,
        });
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("message-error", "Failed to send message");
      }
    });





    socket.on("message-delivered", async (data) => {
      try {
        const { messageId } = data;
        const message = await messageModel.findById(messageId);

        if (message) {
          const statusIndex = message.status.findIndex(
            (s) => s.recipient.toString() === user._id.toString()
          );

          if (statusIndex !== -1 && !message.status[statusIndex].delivered) {
            message.status[statusIndex].delivered = new Date();
            await message.save();

            // Notify sender of delivery
            const senderSocket = onlineUsers.get(message.sender.toString());
            if (senderSocket) {
              io.to(senderSocket.socketId).emit("message-status-update", {
                messageId,
                userId: user._id,
                type: "delivered",
                timestamp: message.status[statusIndex].delivered,
              });
            }
          }
        }
      } catch (error) {
        console.error("Message delivered error:", error);
      }
    });





    socket.on("message-seen", async (data) => {
      try {
        const { messageId } = data;
        const message = await messageModel.findById(messageId);

        if (message) {
          const statusIndex = message.status.findIndex(
            (s) => s.recipient.toString() === user._id.toString()
          );

          if (statusIndex !== -1 && !message.status[statusIndex].seen) {
            message.status[statusIndex].seen = new Date();
            await message.save();

            // Notify sender of seen status
            const senderSocket = onlineUsers.get(message.sender.toString());
            if (senderSocket) {
              io.to(senderSocket.socketId).emit("message-status-update", {
                messageId,
                userId: user._id,
                type: "seen",
                timestamp: message.status[statusIndex].seen,
              });
            }
          }
        }
      } catch (error) {
        console.error("Message seen error:", error);
      }
    });



    socket.on("fetch-message-history", async (data = {}) => {
      try {
        const { page = 1, limit = 50 } = data;

        // Find all conversations for this user
        const conversations = await conversationModel.find({
          participants: user._id,
          isGroup: false,
        });
        // Get messages from all conversations
        const messages = await messageModel
          .find({
            conversationId: { $in: conversations.map((c) => c._id) },
          })
          .populate('sender', 'firstName lastName picture email phone statusMessage socialProfiles')
          .sort({ createdAt: -1 })
          .limit(limit);
          

        socket.emit("message-history", {
          messages: messages.reverse(),
          page,
        });
      } catch (error) {
        console.error("Error fetching messages:", error);
        socket.emit("message-history-error", "Failed to fetch messages");
      }
    });




    socket.on("update-message", async (data) => {
      try {
        const { messageId, text } = data;
        const message = await messageModel.findOne({
          _id: messageId,
          sender: user._id,
        });
        if (message) {
          message.text = text;
          message.edited = true;
          await message.save();

          // Notify all participants
          message.conversation.participants.forEach((participantId) => {
            const receiverData = onlineUsers.get(participantId.toString());
            if (receiverData) {
              io.to(receiverData.socketId).emit("message-updated", {
                messageId,
                text,
                edited: true,
              });
            }
          });
        }
      } catch (error) {
        socket.emit("update-error", "Failed to update message");
      }
    });




    socket.on("create-group", async (data) => {
      try {
        const { name, participants } = data;
        const conversation = await conversationModel.create({
          name,
          participants: [...participants, user._id],
          isGroup: true,
          groupAdmin: user._id,
        });

        // Notify all participants
        participants.forEach((participantId) => {
          const receiverData = onlineUsers.get(participantId.toString());
          if (receiverData) {
            io.to(receiverData.socketId).emit(
              "new-group-created",
              conversation
            );
          }
        });
      } catch (error) {
        socket.emit("group-error", "Failed to create group");
      }
    });



    // Handle user status
    socket.on("userStatus", (status) => {
      const userData = onlineUsers.get(user._id);
      if (userData) {
        userData.userData.status = status;
        onlineUsers.set(user._id, userData);
        broadcastOnlineUsers();
      }
    });



    // Handle user typing events
    socket.on("typing", (data) => {
      const { receiverId } = data;
      socket.to(receiverId).emit("userTyping", {
        userId: user._id,
        typing: true,
      });
    });



    socket.on("stopTyping", (data) => {
      const { receiverId } = data;
      socket.to(receiverId).emit("userTyping", {
        userId: user._id,
        typing: false,
      });
    });



    socket.on("delete-message", async (data) => {
      try {
        const { messageId } = data;
        const message = await messageModel.findOne({
          _id: messageId,
          sender: user._id,
        });

        if (message) {
          await message.deleteOne();

          // Notify all participants
          message.conversation.participants.forEach((participantId) => {
            const receiverData = onlineUsers.get(participantId.toString());
            if (receiverData) {
              io.to(receiverData.socketId).emit("message-deleted", messageId);
            }
          });
        }
      } catch (error) {
        socket.emit("delete-error", "Failed to delete message");
      }
    });



    // sidebar display of all users
    socket.on("fetch-all-users", async () => {
      try {
        const users = await userModel.find(
          {}, 
          {
            firstName: 1,
            lastName: 1,
            picture: 1,
            _id: 1,
            email: 1,
            phone: 1,
            statusMessage: 1,
            socialProfiles: 1
          }
        );
        socket.emit("all-users", users);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    });



    socket.on("reconnect", async () => {
      try {
        // Re-join all rooms
        const userData = onlineUsers.get(user._id);
        if (userData && userData.rooms) {
          userData.rooms.forEach((room) => socket.join(room));
        }

        // Update online status
        broadcastOnlineUsers();
      } catch (error) {
        console.error("Reconnection error:", error);
      }
    });



    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("Client disconnected", socket.id);
      handleUserDisconnection(user._id);
    });



    // Handle errors
    socket.on("error", (error) => {
      console.error("Socket error:", error);
      handleUserDisconnection(user._id);
      socket.disconnect();
    });
  } catch (error) {
    console.error("Socket connection error:", error);
    socket.disconnect();
  }
});

// Periodic cleanup of stale connections
setInterval(() => {
  const staleTimeout = 5 * 60 * 1000; // 5 minutes
  const now = new Date().getTime();

  onlineUsers.forEach((userData, userId) => {
    const lastActive = new Date(userData.userData.lastActive).getTime();
    if (now - lastActive > staleTimeout) {
      handleUserDisconnection(userId);
    }
  });
}, 60000); // Check every minute

module.exports = { app, server };
