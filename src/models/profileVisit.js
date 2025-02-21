const mongoose = require("mongoose");
const { Schema } = mongoose;

const profileVisitSchema = new Schema({
    visitor : {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true  
    },
    visited : {
        type : Schema.Types.ObjectId,
        ref : "User",
        index: true,
        required : true
    },
    visitedAt : {
        type : Date,
        default : Date.now
    }
});

const ProfileVisit = mongoose.model("ProfileVisit", profileVisitSchema);
module.exports = ProfileVisit;