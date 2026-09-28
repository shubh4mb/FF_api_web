import mongoose from "mongoose";

const blacklistSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["ip", "deviceId", "phone", "email"],
      required: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      default: "Administrative ban due to repetitive dispute or damage policy violations",
    },
    sourceUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

blacklistSchema.index({ type: 1, value: 1 }, { unique: true });

export default mongoose.model("Blacklist", blacklistSchema);
