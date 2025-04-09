// process.on("uncaughtException", (err) => {
//   console.log(err.name, err.message);
//   console.log(err.stack);
//   process.exit(1);
// });

// require("dotenv").config();
// const mongoose = require("mongoose");
// const { connectToDatabase } = require("./config");
// const { Message } = require("./src/models");
// const app = require("./src/app");
// const http = require("http");
// const {
//   sendMessage,
//   editMessage,
//   deleteForEveryone,
//   deleteForMe,
// } = require("./src/utils/messagingOperations");
// const { Server } = require("socket.io");


// const { PORT, BASE_URL } = process.env;

// let server;

// (async () => {
//   try {
//     await connectToDatabase();

//     // Create an HTTP server
//     server = http.createServer(app);

//     // Initialize Socket.IO
//     const io = new Server(server, {
//       cors: {
//         origin: "*", // add frontend url here
//         methods: ["GET", "POST", "PATCH", "DELETE"],
//       },
//     });

//     const users = {};

//     // Handle Socket.IO connections
//     io.on("connection", (socket) => {
//       console.log("A user connected:", socket.id);

//       socket.on("join", (userId) => {
//         if (userId) {
//           //users[userId] = socket.id;
//           users[userId] = { socketId: socket.id, status: "online" };
//           console.log(`User with ID ${userId} joined`);

//           // Notify others about the user's online status
//           socket.broadcast.emit("userStatus", { userId, status: "online" });
//         }
//       });

//       // Handling sending a new message
//       socket.on("sendMessage", async (data) => {
//         console.log('send message api gets hit', data)
//         const { senderId, recipientId, messageText } = data;
//         const message = await sendMessage(senderId, recipientId, messageText);

//         console.log('send message -----------------', message)

//         // Emit the message to the recipient if they are online
//         if (users[recipientId]) {
//           io.to(users[recipientId].socketId).emit("newMessage", message);
//         }

//       });

//       socket.on("typing", (data) => {
//         const { senderId, recipientId } = data;

//         if (users[recipientId]) {
//           io.to(users[recipientId].socketId).emit("userTyping", { senderId });
//         }
//       });

//       // socket.on("messageRead", async (data) => {
//       //   console.log('hey budyd mesage read scletr code', data)
//       //   const { messageIds, recipientId, senderId } = data;

//       //   // Update messages as read in database (you'll need to implement this function)
//       //   await markMessagesAsRead(messageIds, recipientId);

//       //   // Notify sender that messages have been read
//       //   if (users[senderId]) {
//       //     io.to(users[senderId].socketId).emit("messagesRead", {
//       //       messageIds,
//       //       recipientId
//       //     });
//       //   }
//       // });


//       // Add to your socket.io server code if not already added
//       socket.on("messageRead", async (data) => {
//         console.log('hey budy mesage read ', data)
//         const { messageIds, recipientId, senderId } = data;

//         console.log(`Marking messages as read: ${messageIds.join(', ')}`);

//         try {
//           // Update messages as read in database
//           // This is likely in your database code
//           await Message.updateMany(
//             { _id: { $in: messageIds } },
//             { $set: { isRead: true } }
//           );

//           // Notify sender that messages have been read
//           if (users[senderId]) {
//             console.log(`Notifying ${senderId} that messages were read`);
//             io.to(users[senderId].socketId).emit("messagesRead", {
//               messageIds,
//               recipientId
//             });
//           }
//         } catch (error) {
//           console.error("Error marking messages as read:", error);
//         }
//       });

//       // Handle message edit
//       socket.on("editMessage", async (data) => {
//         const { messageId, newMessageText, senderId } = data;
//         const updatedMessage = await editMessage(
//           messageId,
//           newMessageText,
//           senderId
//         );

//         // Emit the edited message to both participants
//         if (users[updatedMessage.recipient]) {
//           io.to(users[updatedMessage.recipient]).emit(
//             "messageEdited",
//             updatedMessage
//           );
//         }
//         if (users[updatedMessage.sender]) {
//           io.to(users[updatedMessage.sender]).emit(
//             "messageEdited",
//             updatedMessage
//           );
//         }
//       });

//       // Handle delete for everyone
//       socket.on("deleteForEveryone", async (data) => {
//         const { messageId, userId } = data;
//         const message = await deleteForEveryone(messageId, userId);

//         // Emit the delete event to both participants
//         if (users[message.recipient]) {
//           io.to(users[message.recipient]).emit("messageDeletedForEveryone", {
//             messageId,
//           });
//         }
//         if (users[message.sender]) {
//           io.to(users[message.sender]).emit("messageDeletedForEveryone", {
//             messageId,
//           });
//         }
//       });

//       // Handle delete for self
//       socket.on("deleteForMe", async (data) => {
//         const { messageId, userId } = data;
//         const message = await deleteForMe(messageId, userId);

//         // Emit the delete event only to the user who requested the deletion
//         if (users[userId]) {
//           io.to(users[userId]).emit("messageDeletedForMe", { messageId });
//         }
//       });

//       // On client disconnect
//       socket.on("disconnect", () => {
//         console.log("User disconnected:", socket.id);

//         //let disconnectedUserId = null;

//         // Remove from online users
//         //for (const [userId, socketId] of Object.entries(users)) {
//         for (const [userId, user] of Object.entries(users)) {

//           if (user.socketId === socket.id) {
//             //disconnectedUserId = userId;
//             socket.broadcast.emit("userStatus", { userId, status: "offline" });
//             delete users[userId];
//             break;
//           }
//         }

//       });

//     });

//     // Start the server
//     server
//       .listen(PORT, () => console.log(`Server is running on ${BASE_URL}`))
//       .on("error", shutdown);
//   } catch (error) {
//     shutdown(error);
//   }
// })();

// async function shutdown(err) {
//   console.log("Unable to initialize the server:", err.message);
//   await mongoose.connection.close();
//   process.exit(1);
// }

// process.on("unhandledRejection", (err) => {
//   console.log(err.name, err.message);
//   console.log(err.stack);
//   server.close(() => {
//     process.exit(1);
//   });
// });


//index.js - Fixed version with proper message handling and read receipts
process.on("uncaughtException", (err) => {
  console.log(err.name, err.message);
  console.log(err.stack);
  process.exit(1);
});

require("dotenv").config();
const mongoose = require("mongoose");
const { connectToDatabase } = require("./config");
const { Message } = require("./src/models");
const app = require("./src/app");
const http = require("http");
const {
  sendMessage,
  editMessage,
  deleteForEveryone,
  deleteForMe,
} = require("./src/utils/messagingOperations");
const { Server } = require("socket.io");

const { PORT, BASE_URL } = process.env;

let server;

(async () => {
  try {
    await connectToDatabase();

    // Create an HTTP server
    server = http.createServer(app);

    // Initialize Socket.IO
    const io = new Server(server, {
      cors: {
        origin: "*", // add frontend url here
        methods: ["GET", "POST", "PATCH", "DELETE"],
        // Add longer timeout to help with connection stability
        pingTimeout: 60000,
      },
    });

    // Track users with more detailed status
    const users = {};

    // Handle Socket.IO connections
    io.on("connection", (socket) => {
      console.log("A user connected:", socket.id);

      socket.on("join", (userId) => {
        if (userId) {
          // Store user socket info with online status
          users[userId] = { 
            socketId: socket.id, 
            status: "online",
            lastSeen: new Date()
          };
          console.log(`User with ID ${userId} joined`);

          // Notify others about the user's online status
          socket.broadcast.emit("userStatus", { userId, status: "online" });
        }
      });

      // Handling sending a new message with acknowledgment
      socket.on("sendMessage", async (data, callback) => {
        console.log('Message send request received:', data);
        
        try {
          const { senderId, recipientId, messageText } = data;
          
          // Early validation
          if (!senderId || !recipientId || !messageText) {
            console.log('Missing required fields for sending message');
            if (typeof callback === 'function') {
              callback({ 
                success: false, 
                error: "Missing required fields" 
              });
            }
            return;
          }
          
          // Create message in database
          const message = await sendMessage(senderId, recipientId, messageText);
          
          console.log('Message created in DB:', message);
          
          // If callback exists, acknowledge message creation
          if (typeof callback === 'function') {
            callback({ 
              success: true, 
              messageId: message._id,
              timestamp: message.timestamp
            });
          }
          
          // Emit the message to the recipient if they are online
          if (users[recipientId]) { 
            io.to(users[recipientId].socketId).emit("newMessage", message);
          }
        } catch (error) {
          console.error('Error sending message:', error);
          if (typeof callback === 'function') {
            callback({ success: false, error: "Failed to send message" });
          }
        }
      });

      // Handle typing indicators
      socket.on("typing", (data) => {
        const { senderId, recipientId } = data;
    
        if (users[recipientId]) {
          io.to(users[recipientId].socketId).emit("userTyping", { senderId });
        }
      });

      // Fixed message read receipt handling
      socket.on("messageRead", async (data) => {
        console.log('Message read event received:', data);
        const { messageIds, recipientId, senderId } = data;
        
        if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
          console.log('Invalid messageIds in messageRead event');
          return;
        }
        
        console.log(`Marking messages as read: ${messageIds.join(', ')}`);
        
        try {
          // Update messages as read in database
          const updateResult = await Message.updateMany(
            { 
              _id: { $in: messageIds },
              // Ensure we're only updating messages sent to this recipient
              recipient: recipientId, 
              sender: senderId,
              isRead: false // Only update if not already read
            },
            { $set: { isRead: true } }
          );
          
          console.log(`Updated ${updateResult.modifiedCount} messages as read`);
          
          // Only notify if any messages were actually marked as read
          if (updateResult.modifiedCount > 0) {
            // Notify sender that messages have been read
            if (users[senderId]) {
              console.log(`Notifying ${senderId} that messages were read by ${recipientId}`);
              io.to(users[senderId].socketId).emit("messagesRead", {
                messageIds,
                recipientId
              });
            }
          }
        } catch (error) {
          console.error("Error marking messages as read:", error);
        }
      });

      // Handle message edit
      socket.on("editMessage", async (data) => {
        const { messageId, newMessageText, senderId } = data;
        
        try {
          const updatedMessage = await editMessage(
            messageId,
            newMessageText,
            senderId
          );
          
          if (!updatedMessage) {
            console.log(`Failed to edit message: ${messageId}`);
            return;
          }

          // Emit the edited message to both participants
          if (users[updatedMessage.recipient]) {
            io.to(users[updatedMessage.recipient].socketId).emit(
              "messageEdited",
              updatedMessage
            );
          }
          if (users[updatedMessage.sender]) {
            io.to(users[updatedMessage.sender].socketId).emit(
              "messageEdited",
              updatedMessage
            );
          }
        } catch (error) {
          console.error("Error editing message:", error);
        }
      });

      // Handle delete for everyone
      socket.on("deleteForEveryone", async (data) => {
        const { messageId, userId } = data;
        
        try {
          const message = await deleteForEveryone(messageId, userId);
          
          if (!message) {
            console.log(`Failed to delete message: ${messageId}`);
            return;
          }

          // Emit the delete event to both participants
          if (users[message.recipient]) {
            io.to(users[message.recipient].socketId).emit("messageDeletedForEveryone", {
              messageId,
            });
          }
          if (users[message.sender]) {
            io.to(users[message.sender].socketId).emit("messageDeletedForEveryone", {
              messageId,
            });
          }
        } catch (error) {
          console.error("Error deleting message for everyone:", error);
        }
      });

      // Handle delete for self
      socket.on("deleteForMe", async (data) => {
        const { messageId, userId } = data;
        
        try {
          const message = await deleteForMe(messageId, userId);
          
          if (!message) {
            console.log(`Failed to delete message for user: ${messageId}`);
            return;
          }

          // Emit the delete event only to the user who requested the deletion
          if (users[userId]) {
            io.to(users[userId].socketId).emit("messageDeletedForMe", { messageId });
          }
        } catch (error) {
          console.error("Error deleting message for user:", error);
        }
      });

      // On client disconnect
      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        // Find the disconnected user
        for (const [userId, user] of Object.entries(users)) {
          if (user.socketId === socket.id) {
            // Update last seen timestamp
            const lastSeen = new Date();
            
            // First broadcast offline status to others
            socket.broadcast.emit("userStatus", { 
              userId, 
              status: "offline",
              lastSeen
            });
            
            // Remove user from active users list
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