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
const { Message } = require("./src/models");
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
    console.log('Message read status check requested:', data);
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
        console.log(`Found ${readMessageIds.length} messages that are read`);

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

  // When a user joins
  socket.on("join", (userId) => {
    if (userId) {
      const isNewUser = !users[userId];
      
      // Store user's socket ID and status
      users[userId] = { socketId: socket.id, status: "online" };
      console.log(`User with ID ${userId} joined`);

      // Notify others about the user's online status
      socket.broadcast.emit("userStatus", { userId, status: "online" });

      // Send the new user the status of all currently online users
      const onlineUsers = [];
      for (const [id, user] of Object.entries(users)) {
        if (id !== userId) { // Don't include the user themselves
          onlineUsers.push({ userId: id, status: user.status });
        }
      }
      
      if (onlineUsers.length > 0) {
        socket.emit("usersStatus", onlineUsers);
        console.log(`Sent status of ${onlineUsers.length} online users to ${userId}`);
      }

      // Check if there are any pending read receipts for this user
      checkPendingReadReceipts(userId, socket.id, io);
    }
  });

  // Handle individual user status check requests
  socket.on("checkUserStatus", (data) => {
    const { userId } = data;
    console.log(`Status check requested for user ${userId}`);
    
    if (users[userId]) {
      // User is online, send their status to requester
      socket.emit("userStatus", { userId, status: "online" });
    } else {
      // User is offline
      socket.emit("userStatus", { userId, status: "offline" });
    }
  });

  // Handle bulk user status check requests
  socket.on("checkUsersStatus", (data) => {
    const { userIds } = data;
    console.log(`Status check requested for users: ${userIds ? userIds.join(', ') : 'all'}`);
    
    // If no specific userIds provided, check all users
    const idsToCheck = userIds || Object.keys(users);
    
    const statusUpdates = idsToCheck.map(userId => ({
      userId,
      status: users[userId] ? "online" : "offline"
    }));
    
    socket.emit("usersStatus", statusUpdates);
  });

  // Handling sending a new message
  socket.on("sendMessage", async (data) => {
    console.log('Send message triggered:', data);
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
      console.log('socket.id', socket.id)
      
      // Immediately send confirmation back to sender with 'sent' status
      // Include both temporary ID and server ID
      io.to(socket.id).emit("messageSent", {
        tempId: tempId,
        messageId: savedMessage._id.toString(),
        status: 'sent',
        timestamp: savedMessage.timestamp
      });

      console.log(`Message saved with ID: ${savedMessage._id}, temp ID: ${tempId}`);

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

        console.log(`Message delivered to recipient ${recipientId}, status updated to 'delivered'`);
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

  socket.on("typing", (data) => {
    const { senderId, recipientId } = data;

    if (users[recipientId]) {
      io.to(users[recipientId].socketId).emit("userTyping", { senderId });
    }
  });

  // Handle message read status
  socket.on("messageRead", async (data) => {
    console.log('Message read event received:', data);
    const { messageIds, recipientId, senderId } = data;

    try {
      // Update messages as read in database
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { $set: { isRead: true, status: 'read' } }
      );

      console.log(`Messages marked as read: ${messageIds.join(', ')}`);

      // Notify sender that messages were read
      if (users[senderId]) {
        console.log(`Notifying ${senderId} that messages were read`);
        io.to(users[senderId].socketId).emit("messagesRead", {
          messageIds,
          recipientId
        });
      } else {
        // If sender is offline, store the read receipt for later
        console.log(`Sender ${senderId} is offline, storing read receipt`);
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
        console.log(`User ${userId} is now offline`);
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