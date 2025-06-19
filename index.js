//claud ai code
process.on("uncaughtException", (err) => {
  console.log(err.name, err.message);
  console.log(err.stack);
  process.exit(1);
});

require("dotenv").config();
const mongoose = require("mongoose");
const http = require("http");
const { connectToDatabase } = require("./config");
const { Message, Connection } = require("./src/models");
const app = require("./src/app");
const {
  sendMessage,
  editMessage,
  deleteForEveryone,
  deleteForMe,
} = require("./src/utils/messagingOperations");
const { Server } = require("socket.io");

const { PORT, BASE_URL } = process.env;

let server;

// Store pending read receipts when sender is offline
const pendingReadReceipts = {};

function storePendingReadReceipt(senderId, messageIds, recipientId) {
  if (!pendingReadReceipts[senderId]) {
    pendingReadReceipts[senderId] = [];
  }

  pendingReadReceipts[senderId].push({
    messageIds,
    recipientId,
    timestamp: new Date()
  });

  console.log(`Stored pending read receipt for ${senderId}`);
}

// Check and send pending read receipts when user comes online
function checkPendingReadReceipts(userId, socketId, io) {
  if (pendingReadReceipts[userId] && pendingReadReceipts[userId].length > 0) {
    console.log(`Found ${pendingReadReceipts[userId].length} pending read receipts for ${userId}`);

    // Send all pending read receipts
    pendingReadReceipts[userId].forEach(receipt => {
      io.to(socketId).emit("messagesRead", {
        messageIds: receipt.messageIds,
        recipientId: receipt.recipientId
      });

      console.log(`Sent delayed read receipt to ${userId} for messages ${receipt.messageIds.join(', ')}`);
    });

    // Clear pending receipts for this user
    delete pendingReadReceipts[userId];
  }
}

(async () => {
  try {
    await connectToDatabase();

    // Create an HTTP server
    server = http.createServer(app);

    // Initialize Socket.IO
    const io = new Server(server, {
      cors: {
        origin: "*", // add frontend url here in production
        methods: ["GET", "POST", "PATCH", "DELETE"],
      },
    });

    // Store IO instance in app context for use in routes
    app.set('socketio', io);

    // Track users and their socket connections
    // Modified socket.io server code to handle user status properly

    // Track users and their socket connections
    const users = {};
    app.set('users', users);

    // Handle Socket.IO connections
    io.on("connection", (socket) => {
      console.log("A user connected:", socket.id);

      // Handle checking read status when reconnecting
      socket.on("checkMessageReadStatus", async (data) => {
        const { messageIds, senderId, recipientId } = data;

        try {
          // Find which messages are read
          const messages = await Message.find({
            _id: { $in: messageIds }
          });

          // Filter to only read messages
          const readMessageIds = messages
            .filter(message => message.isRead)
            .map(message => message._id.toString());

          if (readMessageIds.length > 0) {
            // Notify sender about read messages
            socket.emit("messagesRead", {
              messageIds: readMessageIds,
              recipientId
            });
          }
        } catch (error) {
          console.error("Error checking message read status:", error);
        }
      });

      socket.on("join", (userId) => {
        if (userId) {
          // Store user's socket ID and status
          users[userId] = { socketId: socket.id, status: "online" };
          // IMPORTANT: Tell EVERYONE (including the new user) about this user's status
          // This replaces socket.broadcast.emit with io.emit to include the sender
          io.emit("userStatus", { userId, status: "online" });

          // Send the new user the status of ALL other online users
          const onlineUsers = [];
          for (const [id, user] of Object.entries(users)) {
            if (id !== userId) {
              onlineUsers.push({ userId: id, status: user.status });
            }
          }

          if (onlineUsers.length > 0) {
            socket.emit("usersStatus", onlineUsers);
          }
          // Check pending read receipts as before
          checkPendingReadReceipts(userId, socket.id, io);
        }
      });

      // Handling sending a new message
      socket.on("sendMessage", async (data) => {
        const { senderId, recipientId, messageText, tempId } = data;

        try {
          // Create a new message with initial 'sent' status
          const newMessage = new Message({
            sender: senderId,
            recipient: recipientId,
            message: messageText,
            timestamp: new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000),
            status: 'sent',
            isRead: false
          });

          const savedMessage = await newMessage.save();
          // Immediately send confirmation back to sender with 'sent' status
          // Include both temporary ID and server ID
          io.to(socket.id).emit("messageSent", {
            tempId: tempId,
            messageId: savedMessage._id.toString(),
            status: 'sent',
            timestamp: savedMessage.timestamp
          });


          // Check if recipient is online
          if (users[recipientId]) {
            // Update status to 'delivered' in database
            savedMessage.status = 'delivered';
            await savedMessage.save();

            // Send message to recipient
            io.to(users[recipientId].socketId).emit("newMessage", savedMessage);

            // Notify sender that message was delivered
            io.to(socket.id).emit("messageStatusUpdate", {
              tempId: tempId,
              messageId: savedMessage._id.toString(),
              status: 'delivered'
            });
          }
        } catch (error) {
          console.error('Error in sendMessage:', error);
          // Notify sender of failure
          io.to(socket.id).emit("messageError", {
            error: "Failed to send message",
            originalMessage: data
          });
        }
      });

      // When user blocks someone
      socket.on("blockUser", async (data) => {
        const { blockerId, blockedUserId } = data;

        try {
          const connection = await Connection.findOneAndUpdate(
            {
              $or: [
                { sender: blockerId, receiver: blockedUserId },
                { sender: blockedUserId, receiver: blockerId }
              ]
            },
            {
              $set: {
                status: 'Blocked',
                sender: blockerId,
                receiver: blockedUserId
              }
            },
            { new: true }
          );

          // Notify BOTH users immediately
          // socket.emit("connectionStatusChanged", {
          //   userId: blockedUserId,
          //   status: 'blocked_by_you'
          // });

          if (users[blockedUserId]) {
            io.to(users[blockedUserId].socketId).emit("connectionStatusChanged", {
              userId: blockerId,
              status: 'blocked_you'
            });
          }
        } catch (error) {
          console.error('Error blocking user:', error);
        }
      });

      // When connection status changes (unfriend/unfollow)
      socket.on("removeConnection", async (data) => {
        const { userId, otherUserId } = data;

        try {
          await Connection.findOneAndUpdate(
            {
              $or: [
                { sender: userId, receiver: otherUserId, status: 'Accepted' },
                { sender: otherUserId, receiver: userId, status: 'Accepted' }
              ]
            },
            { $set: { status: 'Declined' } }
          );

          // Notify both users
          // socket.emit("connectionStatusChanged", {
          //   userId: otherUserId,
          //   status: 'not_connected'
          // });

          if (users[otherUserId]) {
            io.to(users[otherUserId].socketId).emit("connectionStatusChanged", {
              userId: userId,
              status: 'not_connected'
            });
          }
        } catch (error) {
          console.error('Error removing connection:', error);
        }
      });


      socket.on("typing", (data) => {
        const { senderId, recipientId } = data;

        if (users[recipientId]) {
          io.to(users[recipientId].socketId).emit("userTyping", { senderId });
        }
      });

      // Handle message read status
      socket.on("messageRead", async (data) => {
        const { messageIds, recipientId, senderId } = data;

        try {
          // Update messages as read in database
          await Message.updateMany(
            { _id: { $in: messageIds } },
            { $set: { isRead: true, status: 'read' } }
          );
          // Notify sender that messages were read
          if (users[senderId]) {
            io.to(users[senderId].socketId).emit("messagesRead", {
              messageIds,
              recipientId
            });
          } else {
            // If sender is offline, store the read receipt for later
            storePendingReadReceipt(senderId, messageIds, recipientId);
          }
        } catch (error) {
          console.error("Error marking messages as read:", error);
        }
      });

      // Handle message edit
      socket.on("editMessage", async (data) => {
        const { messageId, newMessageText, senderId } = data;
        const updatedMessage = await editMessage(
          messageId,
          newMessageText,
          senderId
        );

        // Emit the edited message to both participants
        if (updatedMessage) {
          if (users[updatedMessage.recipient.toString()]) {
            io.to(users[updatedMessage.recipient.toString()].socketId).emit(
              "messageEdited",
              updatedMessage
            );
          }

          if (users[updatedMessage.sender.toString()]) {
            io.to(users[updatedMessage.sender.toString()].socketId).emit(
              "messageEdited",
              updatedMessage
            );
          }
        }
      });

      // Handle delete for everyone
      socket.on("deleteForEveryone", async (data) => {
        const { messageId, userId } = data;
        const message = await deleteForEveryone(messageId, userId);

        if (message) {
          // Emit the delete event to both participants
          if (users[message.recipient.toString()]) {
            io.to(users[message.recipient.toString()].socketId).emit("messageDeletedForEveryone", {
              messageId,
            });
          }

          if (users[message.sender.toString()]) {
            io.to(users[message.sender.toString()].socketId).emit("messageDeletedForEveryone", {
              messageId,
            });
          }
        }
      });

      // Handle delete for self
      socket.on("deleteForMe", async (data) => {
        const { messageId, userId } = data;
        const message = await deleteForMe(messageId, userId);

        // Emit the delete event only to the user who requested the deletion
        if (message && users[userId]) {
          io.to(users[userId].socketId).emit("messageDeletedForMe", { messageId });
        }
      });

      // On client disconnect
      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        // Find and remove disconnected user
        for (const [userId, user] of Object.entries(users)) {
          if (user.socketId === socket.id) {
            // Update user status to offline and send last seen timestamp
            socket.broadcast.emit("userStatus", {
              userId,
              status: "offline",
              lastSeen: new Date().toISOString()
            });

            delete users[userId];
            break;
          }
        }
      });
    });

    // Start the server
    server
      .listen(PORT, () => console.log(`Server is running on ${BASE_URL}`))
      .on("error", shutdown);
  } catch (error) {
    shutdown(error);
  }
})();

async function shutdown(err) {
  console.log("Unable to initialize the server:", err.message);
  await mongoose.connection.close();
  process.exit(1);
}

process.on("unhandledRejection", (err) => {
  console.log(err.name, err.message);
  console.log(err.stack);
  server.close(() => {
    process.exit(1);
  });
});

