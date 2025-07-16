const mongoose = require("mongoose");
const { Message } = require("../models");
const { User } = require("../models");


const sendMessage = async (senderId, recipientId, messageText) => {
  
  try {
    console.log("=================", senderId)
    const user = await User.findById(senderId);
  
    if (!user) return "Sender not found";
  
    const message = new Message({
      sender: senderId,
      recipient: recipientId,
      message: messageText,
    });
  
    await message.save();
    return message;
    
  } catch (error) {
    console.log("CompleteErrrrrrrr=====",error)
    console.error("Error sending message:", error.message);
    // You can return a more user-friendly message if needed
    return "Failed to send message due to an error.";
  }
};

const editMessage = async (messageId, newMessageText, userId) => {
  const message = await Message.findOneAndUpdate(
    { _id: messageId, sender: userId, deletedForEveryone: false },
    { message: newMessageText, edited: true },
    { new: true }
  );
  return message;
};

const deleteForEveryone = async (messageId, userId) => {
  const message = await Message.findOneAndUpdate(
    { _id: messageId, sender: userId },
    { deletedForEveryone: true },
    { new: true }
  );
  return message;
};

const deleteForMe = async (messageId, userId) => {
  const message = await Message.findOneAndUpdate(
    { _id: messageId },
    { deletedForUser: true },
    { new: true }
  );
  return message;
};

module.exports = {
  sendMessage,
  editMessage,
  deleteForEveryone,
  deleteForMe,
};
