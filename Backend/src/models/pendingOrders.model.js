import mongoose from 'mongoose';

const pendingOrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  merchantId: { type: String, required: true },
  zoneName: { type: String, required: true }, // e.g., 'edapally'
  pickupLoc: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [lng, lat]
  },
  customerLoc: { // Optional for delivery end
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number]
  },
  acceptTimestamp: { type: Date, default: Date.now },
  status: { type: String, default: 'queued', enum: ['queued', 'assigned', 'cancelled'] },
  assignedRider: String, // Populated on match
  assignedAt: Date
}, { timestamps: true });

pendingOrderSchema.index({ zoneName: 1, acceptTimestamp: 1 }); // FIFO per zone
pendingOrderSchema.index({ pickupLoc: '2dsphere' }); // Geo queries if needed

export default mongoose.model('PendingOrder', pendingOrderSchema);