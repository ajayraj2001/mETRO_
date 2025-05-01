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
// const pendingReadReceipts = {};

// function storePendingReadReceipt(senderId, messageIds, recipientId) {
//   if (!pendingReadReceipts[senderId]) {
//     pendingReadReceipts[senderId] = [];
//   }

//   pendingReadReceipts[senderId].push({
//     messageIds,
//     recipientId,
//     timestamp: new Date()
//   });

//   console.log(`Stored pending read receipt for ${senderId}`);
// }

// // Check and send pending read receipts when user comes online
// function checkPendingReadReceipts(userId, socketId, io) {
//   if (pendingReadReceipts[userId] && pendingReadReceipts[userId].length > 0) {
//     console.log(`Found ${pendingReadReceipts[userId].length} pending read receipts for ${userId}`);

//     // Send all pending read receipts
//     pendingReadReceipts[userId].forEach(receipt => {
//       io.to(socketId).emit("messagesRead", {
//         messageIds: receipt.messageIds,
//         recipientId: receipt.recipientId
//       });

//       console.log(`Sent delayed read receipt to ${userId} for messages ${receipt.messageIds.join(', ')}`);
//     });

//     // Clear pending receipts for this user
//     delete pendingReadReceipts[userId];
//   }
// }

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

    // Store user activity and presence information
    const userPresence = {};

    // Store pending read receipts when sender is offline
    const pendingReadReceipts = {};

    // Constants for presence system
    const INACTIVE_TIMEOUT = 30000; // 30 seconds of inactivity = away
    const OFFLINE_TIMEOUT = 60000;  // 60 seconds without activity = offline
    let presenceInterval = null;

    // Initialize presence monitoring
    function initializePresenceSystem() {
      // Clear any existing interval
      if (presenceInterval) {
        clearInterval(presenceInterval);
      }

      // Run presence checks every 15 seconds (only for inactive detection)
      presenceInterval = setInterval(checkUserPresence, 15000);
      console.log('Presence monitoring system initialized');
    }

    // Check for users who have become inactive or offline
    function checkUserPresence() {
      const now = Date.now();
      const statusChanges = [];

      // Check each connected user
      for (const [userId, data] of Object.entries(userPresence)) {
        if (!data.lastActivity) continue;

        const timeSinceActivity = now - data.lastActivity;
        const currentStatus = data.status;
        let newStatus = currentStatus;

        // Determine status based on activity
        if (timeSinceActivity > OFFLINE_TIMEOUT && currentStatus !== 'offline') {
          newStatus = 'offline';
        } else if (timeSinceActivity > INACTIVE_TIMEOUT && currentStatus === 'online') {
          newStatus = 'away';
        }

        // If status changed, queue it for broadcast
        if (newStatus !== currentStatus) {
          userPresence[userId].status = newStatus;

          // Add to status changes to broadcast
          statusChanges.push({
            userId,
            status: newStatus,
            lastSeen: newStatus === 'offline' ? new Date(data.lastActivity).toISOString() : undefined
          });

          console.log(`User ${userId} automatically changed status to ${newStatus}`);
        }
      }

      // Broadcast status changes if any
      if (statusChanges.length > 0) {
        io.emit('usersStatus', statusChanges);
      }
    }

    // Update a user's activity timestamp
    function updateUserActivity(userId) {
      if (!userId) return;

      // Create presence data if it doesn't exist
      if (!userPresence[userId]) {
        userPresence[userId] = {
          status: 'online',
          lastActivity: Date.now(),
          connections: 0
        };
      } else {
        // Update last activity time
        userPresence[userId].lastActivity = Date.now();

        // If user was offline or away, update to online
        if (userPresence[userId].status !== 'online') {
          userPresence[userId].status = 'online';

          // Broadcast user's online status
          io.emit('userStatus', {
            userId,
            status: 'online'
          });
        }
      }
    }

    // Initialize the presence system on startup
    initializePresenceSystem();

    // Handle Socket.IO connections
    io.on("connection", (socket) => {
      console.log("A user connected:", socket.id);
      let currentUserId = null;

      // Handle checking read status when reconnecting
      socket.on("checkMessageReadStatus", async (data) => {
        const { messageIds, senderId, recipientId } = data;
        if (!messageIds || messageIds.length === 0) return;

        // Update activity timestamp
        updateUserActivity(senderId);

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

      // When a user joins
      socket.on("join", (userId) => {
        if (!userId) return;

        currentUserId = userId;

        // Store user's socket ID
        users[userId] = {
          socketId: socket.id,
          status: "online"
        };

        // Initialize or update presence data
        if (!userPresence[userId]) {
          userPresence[userId] = {
            status: 'online',
            lastActivity: Date.now(),
            connections: 1
          };
        } else {
          userPresence[userId].connections = (userPresence[userId].connections || 0) + 1;
          userPresence[userId].status = 'online';
          userPresence[userId].lastActivity = Date.now();
        }

        console.log(`User with ID ${userId} joined`);

        // Broadcast the user's online status to everyone else
        socket.broadcast.emit("userStatus", {
          userId,
          status: "online"
        });

        // Send the new user the current status of all users
        const statusUpdates = [];

        for (const [id, data] of Object.entries(userPresence)) {
          if (id !== userId && data.status) {
            statusUpdates.push({
              userId: id,
              status: data.status,
              lastSeen: data.status === 'offline' && data.lastActivity ?
                new Date(data.lastActivity).toISOString() : undefined
            });
          }
        }

        if (statusUpdates.length > 0) {
          socket.emit("usersStatus", statusUpdates);
          console.log(`Sent status of ${statusUpdates.length} users to ${userId}`);
        }

        // Check if there are any pending read receipts for this user
        if (pendingReadReceipts[userId] && pendingReadReceipts[userId].length > 0) {
          console.log(`Found ${pendingReadReceipts[userId].length} pending read receipts for ${userId}`);

          // Group receipts by recipient for efficiency
          const groupedReceipts = {};

          pendingReadReceipts[userId].forEach(receipt => {
            if (!groupedReceipts[receipt.recipientId]) {
              groupedReceipts[receipt.recipientId] = new Set();
            }
            receipt.messageIds.forEach(id => groupedReceipts[receipt.recipientId].add(id));
          });

          // Send each group
          for (const [recipientId, messageIds] of Object.entries(groupedReceipts)) {
            socket.emit("messagesRead", {
              messageIds: Array.from(messageIds),
              recipientId
            });
          }

          // Clear pending receipts
          delete pendingReadReceipts[userId];
        }
      });

      // Handle individual user status check - only used when opening a chat
      socket.on("checkUserStatus", (data) => {
        const { userId } = data;
        if (!userId) return;

        // Update requester's activity
        if (currentUserId) {
          updateUserActivity(currentUserId);
        }

        // Respond with current status from presence system
        if (userPresence[userId]) {
          socket.emit("userStatus", {
            userId,
            status: userPresence[userId].status,
            lastSeen: userPresence[userId].status === 'offline' && userPresence[userId].lastActivity ?
              new Date(userPresence[userId].lastActivity).toISOString() : undefined
          });
        } else {
          // User not in system at all
          socket.emit("userStatus", {
            userId,
            status: "offline"
          });
        }
      });

      // Handle bulk user status check - only used when app launches
      socket.on("checkUsersStatus", (data) => {
        const { userIds } = data;

        // Update requester's activity
        if (currentUserId) {
          updateUserActivity(currentUserId);
        }

        // Determine which users to check
        const idsToCheck = userIds && userIds.length > 0 ?
          userIds :
          Object.keys(userPresence);

        // Prepare status updates
        const statusUpdates = idsToCheck.map(userId => {
          if (userPresence[userId]) {
            return {
              userId,
              status: userPresence[userId].status,
              lastSeen: userPresence[userId].status === 'offline' && userPresence[userId].lastActivity ?
                new Date(userPresence[userId].lastActivity).toISOString() : undefined
            };
          } else {
            return { userId, status: 'offline' };
          }
        });

        // Send status updates
        if (statusUpdates.length > 0) {
          socket.emit("usersStatus", statusUpdates);
        }
      });

      // Handle sending a new message
      socket.on("sendMessage", async (data) => {
        const { senderId, recipientId, messageText, tempId } = data;
        if (!senderId || !recipientId || !messageText) {
          socket.emit("messageError", {
            error: "Missing required fields",
            originalMessage: data
          });
          return;
        }

        // Update sender's activity
        updateUserActivity(senderId);

        try {
          // Create a new message with initial 'sent' status
          const newMessage = new Message({
            sender: senderId,
            recipient: recipientId,
            message: messageText,
            timestamp: new Date(),
            status: 'sent',
            isRead: false
          });

          const savedMessage = await newMessage.save();

          // Immediately send confirmation back to sender with 'sent' status
          socket.emit("messageSent", {
            tempId: tempId,
            messageId: savedMessage._id.toString(),
            status: 'sent',
            timestamp: savedMessage.timestamp
          });

          // Check if recipient is online
          const isRecipientOnline = userPresence[recipientId] &&
            (userPresence[recipientId].status === 'online' ||
              userPresence[recipientId].status === 'away');

          if (isRecipientOnline && users[recipientId]) {
            // Update status to 'delivered'
            savedMessage.status = 'delivered';
            await savedMessage.save();

            // Send message to recipient
            io.to(users[recipientId].socketId).emit("newMessage", savedMessage);

            // Notify sender that message was delivered
            socket.emit("messageStatusUpdate", {
              tempId: tempId,
              messageId: savedMessage._id.toString(),
              status: 'delivered'
            });
          }
        } catch (error) {
          console.error('Error in sendMessage:', error);
          socket.emit("messageError", {
            error: "Failed to send message",
            originalMessage: data
          });
        }
      });

      // Handle typing indicator
      socket.on("typing", (data) => {
        const { senderId, recipientId } = data;
        if (!senderId || !recipientId) return;

        // Update activity timestamp
        updateUserActivity(senderId);

        // Only forward typing indicator if recipient is online
        if (users[recipientId]) {
          io.to(users[recipientId].socketId).emit("userTyping", { senderId });
        }
      });

      // Handle message read status
      socket.on("messageRead", async (data) => {
        const { messageIds, recipientId, senderId } = data;
        if (!messageIds || !messageIds.length || !recipientId || !senderId) return;

        // Update activity timestamp
        updateUserActivity(recipientId);

        try {
          // Update messages as read in database
          await Message.updateMany(
            { _id: { $in: messageIds } },
            { $set: { isRead: true, status: 'read' } }
          );

          // Notify sender that messages were read if online
          if (users[senderId]) {
            io.to(users[senderId].socketId).emit("messagesRead", {
              messageIds,
              recipientId
            });
          } else {
            // Store read receipt for later if sender is offline
            if (!pendingReadReceipts[senderId]) {
              pendingReadReceipts[senderId] = [];
            }

            // Add new receipt
            pendingReadReceipts[senderId].push({
              messageIds,
              recipientId,
              timestamp: new Date()
            });
          }
        } catch (error) {
          console.error("Error marking messages as read:", error);
        }
      });

      // Handle client disconnect
      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        // Find the disconnected user
        if (!currentUserId) return;

        // Update presence data
        if (userPresence[currentUserId]) {
          // Decrease connection count
          userPresence[currentUserId].connections = Math.max(0, (userPresence[currentUserId].connections || 1) - 1);

          // If this was the last connection, mark user as away first (not immediately offline)
          // This helps handle temporary disconnections without flickering status
          if (userPresence[currentUserId].connections === 0) {
            userPresence[currentUserId].status = 'away';
            userPresence[currentUserId].disconnectedAt = Date.now();

            // We don't immediately broadcast offline - presence system will handle this
            // after the timeout if the user doesn't reconnect
          }
        }

        // Remove socket reference
        if (users[currentUserId] && users[currentUserId].socketId === socket.id) {
          delete users[currentUserId];
        }
      });

      // Generic activity event for any interaction
      socket.on("userActivity", (data) => {
        if (currentUserId) {
          updateUserActivity(currentUserId);
        }
      });
    });

    // Cleanup resources on server shutdown
    process.on('SIGINT', () => {
      if (presenceInterval) {
        clearInterval(presenceInterval);
      }
      process.exit(0);
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