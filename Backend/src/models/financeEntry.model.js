import mongoose from 'mongoose';

const splitItemSchema = new mongoose.Schema(
  {
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
    },
    partnerName: {
      type: String,
      required: true,
    },
    shareAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    isSettled: {
      type: Boolean,
      default: false,
    },
    settledAt: {
      type: Date,
      default: null,
    },
    settlementNotes: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const financeEntrySchema = new mongoose.Schema(
  {
    entryType: {
      type: String,
      enum: ['EXPENSE', 'INCOME'],
      required: true,
      default: 'EXPENSE',
    },
    title: {
      type: String,
      required: [true, 'Title / Description is required'],
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      default: 'Miscellaneous',
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    paymentMode: {
      type: String,
      enum: ['UPI', 'Bank Transfer', 'Cash', 'Credit Card', 'Debit Card', 'FlashFits Account', 'Other'],
      default: 'UPI',
    },
    paidByPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner',
      default: null, // null means Company Account / FlashFits Pool
    },
    paidByName: {
      type: String,
      default: 'Company / FlashFits Account',
    },
    isSplit: {
      type: Boolean,
      default: false,
    },
    splitType: {
      type: String,
      enum: ['EQUAL', 'CUSTOM', 'NONE'],
      default: 'NONE',
    },
    splits: [splitItemSchema],
    notes: {
      type: String,
      default: '',
    },
    receiptUrl: {
      type: String,
      default: '',
    },
    createdByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
  },
  { timestamps: true }
);

financeEntrySchema.index({ entryType: 1, date: -1 });
financeEntrySchema.index({ 'splits.partner': 1, 'splits.isSettled': 1 });

const FinanceEntry = mongoose.model('FinanceEntry', financeEntrySchema);
export default FinanceEntry;

