// index.js - Main Server File
require("dotenv").config();
const mongoose = require("mongoose");
const { connectToDatabase } = require("./config");
const { Message } = require("./src/models");
const app = require("./src/app");
const http = require("http");
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
        origin: "*",
        methods: ["GET", "POST", "PATCH", "DELETE"],
      },
    });

    // Track users and their statuses
    const users = {};

    // Handle Socket.IO connections
    io.on("connection", (socket) => {
      console.log("A user connected:", socket.id);

      // User joins and sets their online status
      socket.on("join", (userId) => {
        if (userId) {
          users[userId] = { socketId: socket.id, status: "online" };
          console.log(`User with ID ${userId} joined`);

          // Notify others about the user's online status
          socket.broadcast.emit("userStatus", { userId, status: "online" });
        }
      });

      // Sending a new message
      // socket.on("sendMessage", async (data) => {
      //   console.log('Send message triggered:', data);
      //   const { senderId, recipientId, messageText } = data;
        
      //   try {
      //     // Create a new message with initial 'sent' status
      //     const newMessage = new Message({
      //       sender: senderId,
      //       recipient: recipientId,
      //       message: messageText,
      //       timestamp: new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000),
      //       status: 'sent',
      //       isRead: false
      //     });
          
      //     const savedMessage = await newMessage.save();
      //     // console.log('socket code', socket)
      //     console.log('socket', socket.id)

      //     if(users[senderId]){
      //       console.log('users[senderId',users[senderId])
      //     }
      //     // Immediately send confirmation back to sender with 'sent' status
      //     io.to(users[senderId].socketId).emit("messageSent", {
      //       messageId: savedMessage._id,
      //       status: 'sent',
      //       timestamp: savedMessage.timestamp
      //     });
      //     // return
          
      //     // Check if recipient is online
      //     if (users[recipientId]) {
      //       console.log('user[recipientId]', users[recipientId])
      //       // Update status to 'delivered' in database
      //       savedMessage.status = 'delivered';
      //       await savedMessage.save();
            
      //       // Send message to recipient
      //       io.to(users[recipientId].socketId).emit("newMessage", savedMessage);
            
      //       // Notify sender that message was delivered
      //       io.to(socket.id).emit("messageStatusUpdate", {
      //         messageId: savedMessage._id,
      //         status: 'delivered'
      //       });
      //     }
          
      //     console.log('Message saved and processed:', savedMessage._id);
      //   } catch (error) {
      //     console.error('Error in sendMessage:', error);
      //     // Notify sender of failure
      //     io.to(socket.id).emit("messageError", {
      //       error: "Failed to send message",
      //       originalMessage: data
      //     });
      //   }
      // });


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
          
          // Immediately send confirmation back to sender with 'sent' status
          // Include both the temporary ID and the server's ID
          io.to(socket.id).emit("messageSent", {
            tempId: tempId,                   // Client's temporary ID
            messageId: savedMessage._id,      // Server's MongoDB ID
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
            // Include both IDs here too for consistency
            io.to(socket.id).emit("messageStatusUpdate", {
              tempId: tempId,
              messageId: savedMessage._id,
              status: 'delivered'
            });
          }
          
          console.log('Message saved and processed:', savedMessage._id);
        } catch (error) {
          console.error('Error in sendMessage:', error);
          // Notify sender of failure
          io.to(socket.id).emit("messageError", {
            error: "Failed to send message",
            originalMessage: data
          });
        }
      });
      
      // Modify the messageRead handler to ensure proper IDs
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
          // Make sure to pass the same IDs back
          if (users[senderId]) {
            io.to(users[senderId].socketId).emit("messagesRead", {
              messageIds,  // Send the same message IDs
              recipientId
            });
          }
        } catch (error) {
          console.error("Error marking messages as read:", error);
        }
      });

      // Handle typing indicators
      socket.on("typing", (data) => {
        const { senderId, recipientId } = data;
    
        if (users[recipientId]) {
          io.to(users[recipientId].socketId).emit("userTyping", { senderId });
        }
      });

      // Handle message read confirmation
      // socket.on("messageRead", async (data) => {
      //   console.log('Message read event received:', data);
      //   const { messageIds, recipientId, senderId } = data;
        
      //   try {
      //     // Update messages as read in database
      //     await Message.updateMany(
      //       { _id: { $in: messageIds } },
      //       { $set: { isRead: true, status: 'read' } }
      //     );
          
      //     console.log(`Messages marked as read: ${messageIds.join(', ')}`);
          
      //     // Notify sender that messages were read
      //     if (users[senderId]) {
      //       io.to(users[senderId].socketId).emit("messagesRead", {
      //         messageIds,
      //         recipientId
      //       });
      //     }
      //   } catch (error) {
      //     console.error("Error marking messages as read:", error);
      //   }
      // });

      // Handle message edit
      socket.on("editMessage", async (data) => {
        const { messageId, newMessageText, senderId } = data;
        
        try {
          const message = await Message.findById(messageId);
          
          if (!message || message.sender.toString() !== senderId) {
            return socket.emit("messageError", {
              error: "Cannot edit this message",
              messageId
            });
          }
          
          message.message = newMessageText;
          message.edited = true;
          await message.save();
          
          // Notify both sender and recipient about the edit
          if (users[message.recipient.toString()]) {
            io.to(users[message.recipient.toString()].socketId).emit("messageEdited", message);
          }
          
          socket.emit("messageEdited", message);
          
        } catch (error) {
          console.error("Error editing message:", error);
          socket.emit("messageError", {
            error: "Failed to edit message",
            messageId
          });
        }
      });

      // Handle delete for everyone
      socket.on("deleteForEveryone", async (data) => {
        const { messageId, userId } = data;
        
        try {
          const message = await Message.findById(messageId);
          
          if (!message || message.sender.toString() !== userId) {
            return socket.emit("messageError", {
              error: "Cannot delete this message",
              messageId
            });
          }
          
          message.deletedForEveryone = true;
          await message.save();
          
          // Notify both parties about deletion
          if (users[message.recipient.toString()]) {
            io.to(users[message.recipient.toString()].socketId).emit("messageDeletedForEveryone", {
              messageId
            });
          }
          
          socket.emit("messageDeletedForEveryone", { messageId });
          
        } catch (error) {
          console.error("Error deleting message for everyone:", error);
          socket.emit("messageError", {
            error: "Failed to delete message",
            messageId
          });
        }
      });

      // Handle delete for self
      socket.on("deleteForMe", async (data) => {
        const { messageId, userId } = data;
        
        try {
          const message = await Message.findById(messageId);
          
          if (!message) {
            return socket.emit("messageError", {
              error: "Message not found",
              messageId
            });
          }
          
          // If user is the sender
          if (message.sender.toString() === userId) {
            message.deletedForUser = true;
          }
          // If user is the recipient
          else if (message.recipient.toString() === userId) {
            message.deletedForUser = true;
          } else {
            return socket.emit("messageError", {
              error: "Cannot delete this message",
              messageId
            });
          }
          
          await message.save();
          socket.emit("messageDeletedForMe", { messageId });
          
        } catch (error) {
          console.error("Error deleting message for self:", error);
          socket.emit("messageError", {
            error: "Failed to delete message",
            messageId
          });
        }
      });

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        // Find and remove disconnected user
        for (const [userId, user] of Object.entries(users)) {
          if (user.socketId === socket.id) {
            // Update user status to offline
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

process.on("uncaughtException", (err) => {
  console.log(err.name, err.message);
  console.log(err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.log(err.name, err.message);
  console.log(err.stack);
  server.close(() => {
    process.exit(1);
  });
});