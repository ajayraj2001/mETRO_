const blockUser = asyncHandler(async (req, res, next) => {
    const senderId = req.user._id;
    const { receiverId } = req.body;

    if (!receiverId || senderId.toString() === receiverId) {
        return next(new ApiError("Invalid receiver ID", 400));
    }

    try {
        // Check if there's an existing connection (Accepted/Pending/Declined)
        const existingConnection = await Connection.findOne({
            $or: [
                { sender: senderId, receiver: receiverId },
                { sender: receiverId, receiver: senderId }
            ]
        });

        let wasConnected = false;
        if (existingConnection && existingConnection.status === "Accepted") {
            wasConnected = true;
        }

        // Remove any existing connections first
        await Connection.deleteMany({
            $or: [
                { sender: senderId, receiver: receiverId },
                { sender: receiverId, receiver: senderId }
            ]
        });

        // Add block record with metadata about previous connection
        const block = new Connection({
            sender: senderId,
            receiver: receiverId,
            status: "Blocked",
            // Store whether they were connected before blocking
            metadata: {
                wasConnectedBeforeBlock: wasConnected
            }
        });
        await block.save();

        // Emit socket events for real-time updates
        const io = req.app.get('socketio');
        const users = req.app.get('users') || {};

        if (io) {
            const blockedUserSocket = users[receiverId]?.socketId;
            if (blockedUserSocket) {
                io.to(blockedUserSocket).emit("chatPermissionsUpdated", {
                    userId: senderId.toString(),
                    status: "blocked"
                });
            }
        }

        res.status(200).json({
            success: true,
            message: "User blocked successfully"
        });

    } catch (error) {
        console.error('Error in blockUser:', error);
        return next(new ApiError("Failed to block user", 500));
    }
});

const unblockUser = asyncHandler(async (req, res, next) => {
    const senderId = req.user._id;
    const { receiverId } = req.body;

    if (!receiverId) {
        return next(new ApiError("Receiver ID is required", 400));
    }

    try {
        // Find the block record
        const blockRecord = await Connection.findOne({
            sender: senderId,
            receiver: receiverId,
            status: "Blocked"
        });

        if (!blockRecord) {
            return next(new ApiError("No block found for this user", 404));
        }

        // Check if they were connected before blocking
        const wasConnectedBefore = blockRecord.metadata?.wasConnectedBeforeBlock || false;

        // Remove the block record
        await Connection.findOneAndDelete({
            sender: senderId,
            receiver: receiverId,
            status: "Blocked"
        });

        // If they were connected before blocking, restore the connection
        if (wasConnectedBefore) {
            const restoredConnection = new Connection({
                sender: senderId,
                receiver: receiverId,
                status: "Accepted",
                // Preserve original creation date if possible, or use current date
                createdAt: new Date() // You might want to store original date in metadata too
            });
            await restoredConnection.save();
        }

        // Emit socket events for real-time updates
        const io = req.app.get('socketio');
        const users = req.app.get('users') || {};

        if (io) {
            const unblockedUserSocket = users[receiverId]?.socketId;
            if (unblockedUserSocket) {
                io.to(unblockedUserSocket).emit("chatPermissionsUpdated", {
                    userId: senderId.toString(),
                    status: "unblocked",
                    connectionRestored: wasConnectedBefore
                });
            }
        }

        res.status(200).json({
            success: true,
            message: "User unblocked successfully",
            connectionRestored: wasConnectedBefore
        });

    } catch (error) {
        console.error('Error in unblockUser:', error);
        return next(new ApiError("Failed to unblock user", 500));
    }
});


const mongoose = require("mongoose");
const { Schema } = mongoose;

const connectionSchema = new Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    status: {
        type: String,
        enum: ["Pending", "Accepted", "Declined", "Blocked"],
        default: "Pending"
    },
    // Add metadata field to store additional information
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Index for faster queries
connectionSchema.index({ sender: 1, receiver: 1 }, { unique: true });

// Index for status-based queries
connectionSchema.index({ status: 1 });

const Connection = mongoose.model("Connection", connectionSchema);

module.exports = Connection;