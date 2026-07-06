import mongoose from "mongoose";

const OnlineSessionSchema = new mongoose.Schema(
  {
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryRider",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "ended"],
      default: "active",
    },
    startedAt: {
      type: Date,
      required: true,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    lastHeartbeatAt: {
      type: Date,
      required: true,
    },
    endReason: {
      type: String,
      enum: ["manual", "heartbeat_timeout", null],
      default: null,
    },
    totalDurationMs: {
      type: Number,
      default: 0,
    },
    completedOrderIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
  },
  { timestamps: true }
);

// Enforce at most one active session per rider
OnlineSessionSchema.index(
  { riderId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

// Session history queries
OnlineSessionSchema.index({ riderId: 1, startedAt: -1 });

export default mongoose.models.OnlineSession ||
  mongoose.model("OnlineSession", OnlineSessionSchema);
