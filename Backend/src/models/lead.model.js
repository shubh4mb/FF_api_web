import mongoose from 'mongoose';

const leadLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Call', 'Visit', 'Email', 'Other'],
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  response: {
    type: String,
    required: true
  },
  salesPerson: {
    type: String,
    required: true
  }
}, { timestamps: true });

const leadSchema = new mongoose.Schema({
  shopName: {
    type: String,
    required: true,
    trim: true
  },
  ownerName: {
    type: String,
    trim: true
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  ownerPhoneNumber: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  location: {
    latitude: {
      type: Number
    },
    longitude: {
      type: Number
    }
  },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Visit Scheduled', 'Negotiating', 'Onboarded', 'Not Interested'],
    default: 'New'
  },
  logs: [leadLogSchema],
  lastContactedAt: {
    type: Date
  },
  nextFollowUp: {
    type: Date
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  }
}, { timestamps: true });

export default mongoose.models.Lead || mongoose.model('Lead', leadSchema);
