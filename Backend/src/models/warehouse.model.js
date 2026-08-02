import mongoose from 'mongoose';
import crypto from 'crypto';

const warehouseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Unique identifier e.g. "WH-KOC-01"
    code: { type: String, unique: true },

    // One warehouse can serve multiple zones (Q1: B)
    zoneIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Zone',
      },
    ],

    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      landmark: String,
      // GeoJSON Point for distance calculations (pickup location in orders)
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: {
          type: [Number], // [longitude, latitude]
          index: '2dsphere',
        },
      },
    },

    manager: {
      name: String,
      phone: String,
      email: String,
    },

    operatingHours: {
      open: { type: String },  // e.g. "09:00"
      close: { type: String }, // e.g. "21:00"
      daysOpen: [String],      // ["Monday", "Tuesday", ...]
    },

    // Commission rate for sales from this warehouse (overrides AppConfig default)
    commissionRate: {
      type: Number,
      default: null, // null = use AppConfig.defaultWarehouseCommissionRate
      min: 0,
      max: 100,
    },

    // What order types this warehouse supports
    supportsTryAndBuy: { type: Boolean, default: true },
    supportsCourier: { type: Boolean, default: true },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

warehouseSchema.index({ 'address.location': '2dsphere' });

// Auto-generate warehouse code on creation (e.g. WH-A1B2C3D4)
warehouseSchema.pre('save', function (next) {
  if (this.isNew && !this.code) {
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
    this.code = `WH-${rand}`;
  }
  next();
});

export default mongoose.model('Warehouse', warehouseSchema);
