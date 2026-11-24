import Partner from '../../models/partner.model.js';
import FinanceEntry from '../../models/financeEntry.model.js';
import mongoose from 'mongoose';
import { storageService } from '../../services/storage.service.js';

// ── PARTNERS MANAGEMENT ──

/**
 * Get all active partners (creates initial default partners if empty)
 */
export const getPartners = async (req, res) => {
  try {
    let partners = await Partner.find().sort({ createdAt: 1 });

    // Seed default partners if none exist
    if (partners.length === 0) {
      const defaultNames = ['Shubham', 'Efron', 'Udith', 'Visakh'];
      const docs = defaultNames.map((name) => ({ name, isActive: true }));
      partners = await Partner.insertMany(docs);
    }

    return res.status(200).json({
      success: true,
      data: partners,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch partners',
      error: error.message,
    });
  }
};

/**
 * Add a new partner
 */
export const createPartner = async (req, res) => {
  try {
    const { name, email, phone, upiId, notes } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Partner name is required' });
    }

    const existing = await Partner.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Partner with this name already exists' });
    }

    const partner = await Partner.create({
      name: name.trim(),
      email: email ? email.trim() : '',
      phone: phone ? phone.trim() : '',
      upiId: upiId ? upiId.trim() : '',
      notes: notes ? notes.trim() : '',
    });

    return res.status(201).json({
      success: true,
      message: 'Partner created successfully',
      data: partner,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create partner',
      error: error.message,
    });
  }
};

/**
 * Update partner
 */
export const updatePartner = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, upiId, isActive, notes } = req.body;

    const partner = await Partner.findById(id);
    if (!partner) {
      return res.status(404).json({ success: false, message: 'Partner not found' });
    }

    if (name) partner.name = name.trim();
    if (email !== undefined) partner.email = email.trim();
    if (phone !== undefined) partner.phone = phone.trim();
    if (upiId !== undefined) partner.upiId = upiId.trim();
    if (isActive !== undefined) partner.isActive = Boolean(isActive);
    if (notes !== undefined) partner.notes = notes;

    await partner.save();

    return res.status(200).json({
      success: true,
      message: 'Partner updated successfully',
      data: partner,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update partner',
      error: error.message,
    });
  }
};

/**
 * Delete partner
 */
export const deletePartner = async (req, res) => {
  try {
    const { id } = req.params;

    const partner = await Partner.findById(id);
    if (!partner) {
      return res.status(404).json({ success: false, message: 'Partner not found' });
    }

    // Check if partner is used in any finance entries
    const inUse = await FinanceEntry.findOne({
      $or: [
        { paidByPartner: id },
        { 'splits.partner': id },
      ],
    });

    if (inUse) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete partner because they have associated financial records or splits. You can mark them inactive instead.',
      });
    }

    await Partner.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Partner deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete partner',
      error: error.message,
    });
  }
};

// ── FINANCE ENTRIES (INCOME / EXPENSE) ──

/**
 * Get all entries with filtering, pagination and summary
 */
export const getFinanceEntries = async (req, res) => {
  try {
    const {
      entryType,
      category,
      startDate,
      endDate,
      paidByPartner,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    const query = {};

    if (entryType && ['EXPENSE', 'INCOME'].includes(entryType)) {
      query.entryType = entryType;
    }

    if (category) {
      query.category = category;
    }

    if (paidByPartner) {
      if (paidByPartner === 'company') {
        query.paidByPartner = null;
      } else {
        query.paidByPartner = paidByPartner;
      }
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [entries, total] = await Promise.all([
      FinanceEntry.find(query)
        .populate('paidByPartner', 'name email phone upiId')
        .populate('splits.partner', 'name email phone')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      FinanceEntry.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: entries,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch finance entries',
      error: error.message,
    });
  }
};

/**
 * Create a new finance entry (Expense / Income with auto or custom split)
 */
export const createFinanceEntry = async (req, res) => {
  try {
    let {
      entryType = 'EXPENSE',
      title,
      category = 'Miscellaneous',
      amount,
      date,
      paymentMode = 'UPI',
      paidByPartner,
      isSplit = false,
      splitType = 'NONE',
      splitPartners = [],
      notes = '',
      receiptUrl = '',
    } = req.body;

    // Parse JSON fields if incoming as multipart/form-data
    if (typeof isSplit === 'string') {
      isSplit = isSplit === 'true';
    }
    if (typeof splitPartners === 'string') {
      try {
        splitPartners = JSON.parse(splitPartners);
      } catch (e) {
        splitPartners = [];
      }
    }

    // Handle optional file upload if uploaded
    if (req.file) {
      try {
        const uploadResult = await storageService.uploadSingle(req.file, 'finance_receipts');
        if (uploadResult?.url) {
          receiptUrl = uploadResult.url;
        }
      } catch (uploadError) {
        console.error('Receipt upload error:', uploadError);
        // Continue or log without failing entire entry creation
      }
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title / Description is required' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive amount is required' });
    }

    // Resolve paidByPartner details
    let resolvedPaidByPartner = null;
    let resolvedPaidByName = 'Company / FlashFits Account';

    if (paidByPartner && mongoose.Types.ObjectId.isValid(paidByPartner)) {
      const partnerDoc = await Partner.findById(paidByPartner);
      if (partnerDoc) {
        resolvedPaidByPartner = partnerDoc._id;
        resolvedPaidByName = partnerDoc.name;
      }
    } else if (req.body.paidByName) {
      resolvedPaidByName = req.body.paidByName;
    }

    // Build splits array
    let finalSplits = [];
    if (isSplit && Array.isArray(splitPartners) && splitPartners.length > 0) {
      if (splitType === 'EQUAL') {
        // Equal split among all selected partners
        const count = splitPartners.length;
        const equalShare = Number((numAmount / count).toFixed(2));

        for (const item of splitPartners) {
          const partnerId = typeof item === 'object' ? item.partnerId || item._id : item;
          const pDoc = await Partner.findById(partnerId);
          if (pDoc) {
            // If the payer is one of the split participants, mark their portion settled by default
            const isPayer = resolvedPaidByPartner && resolvedPaidByPartner.toString() === pDoc._id.toString();
            finalSplits.push({
              partner: pDoc._id,
              partnerName: pDoc.name,
              shareAmount: equalShare,
              paidAmount: isPayer ? equalShare : 0,
              isSettled: Boolean(isPayer),
              settledAt: isPayer ? new Date() : null,
              settlementNotes: isPayer ? 'Paid directly during expense creation' : '',
            });
          }
        }
      } else {
        // Custom split: each item has partnerId and shareAmount
        for (const item of splitPartners) {
          const partnerId = item.partnerId || item.partner || item._id;
          const pDoc = await Partner.findById(partnerId);
          if (pDoc) {
            const share = Number(item.shareAmount) || 0;
            const isPayer = resolvedPaidByPartner && resolvedPaidByPartner.toString() === pDoc._id.toString();
            let paidAmount = item.paidAmount !== undefined ? Number(item.paidAmount) : (isPayer ? share : 0);
            const settled = item.isSettled !== undefined ? Boolean(item.isSettled) : (paidAmount >= share);
            if (settled && paidAmount < share) {
              paidAmount = share;
            }
            finalSplits.push({
              partner: pDoc._id,
              partnerName: pDoc.name,
              shareAmount: share,
              paidAmount: paidAmount,
              isSettled: settled,
              settledAt: settled ? new Date() : null,
              settlementNotes: item.settlementNotes || (isPayer ? 'Paid directly during expense creation' : ''),
            });
          }
        }
      }
    }

    const entry = await FinanceEntry.create({
      entryType: entryType.toUpperCase(),
      title: title.trim(),
      category: category.trim(),
      amount: numAmount,
      date: date ? new Date(date) : new Date(),
      paymentMode,
      paidByPartner: resolvedPaidByPartner,
      paidByName: resolvedPaidByName,
      isSplit: Boolean(isSplit && finalSplits.length > 0),
      splitType: isSplit ? splitType : 'NONE',
      splits: finalSplits,
      notes: notes ? notes.trim() : '',
      receiptUrl: receiptUrl ? receiptUrl.trim() : '',
      createdByAdmin: req.admin?._id || null,
    });

    return res.status(201).json({
      success: true,
      message: 'Finance entry recorded successfully',
      data: entry,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create finance entry',
      error: error.message,
    });
  }
};

/**
 * Update an existing finance entry
 */
export const updateFinanceEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await FinanceEntry.findById(id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Finance entry not found' });
    }

    const {
      entryType,
      title,
      category,
      amount,
      date,
      paymentMode,
      paidByPartner,
      notes,
    } = req.body;
    let receiptUrl = req.body.receiptUrl;

    if (req.file) {
      try {
        const uploadResult = await storageService.uploadSingle(req.file, 'finance_receipts');
        if (uploadResult?.url) {
          receiptUrl = uploadResult.url;
        }
      } catch (uploadError) {
        console.error('Receipt upload error:', uploadError);
      }
    }

    if (entryType) entry.entryType = entryType;
    if (title) entry.title = title.trim();
    if (category) entry.category = category.trim();
    if (amount !== undefined) entry.amount = Number(amount);
    if (date) entry.date = new Date(date);
    if (paymentMode) entry.paymentMode = paymentMode;
    if (notes !== undefined) entry.notes = notes;
    if (receiptUrl !== undefined) entry.receiptUrl = receiptUrl;

    if (paidByPartner !== undefined) {
      if (paidByPartner && mongoose.Types.ObjectId.isValid(paidByPartner)) {
        const partnerDoc = await Partner.findById(paidByPartner);
        entry.paidByPartner = partnerDoc ? partnerDoc._id : null;
        entry.paidByName = partnerDoc ? partnerDoc.name : 'Company / FlashFits Account';
      } else {
        entry.paidByPartner = null;
        entry.paidByName = 'Company / FlashFits Account';
      }
    }

    await entry.save();

    return res.status(200).json({
      success: true,
      message: 'Finance entry updated successfully',
      data: entry,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update finance entry',
      error: error.message,
    });
  }
};

/**
 * Delete finance entry
 */
export const deleteFinanceEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await FinanceEntry.findByIdAndDelete(id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Finance entry not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Finance entry deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete finance entry',
      error: error.message,
    });
  }
};

/**
 * Toggle or update the settlement status of a specific partner's split in an entry
 */
export const toggleSplitSettlement = async (req, res) => {
  try {
    const { entryId, splitId } = req.params;
    const { isSettled, paidAmount, settlementNotes } = req.body;

    const entry = await FinanceEntry.findById(entryId);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    const splitItem = entry.splits.id(splitId);
    if (!splitItem) {
      return res.status(404).json({ success: false, message: 'Split item not found in entry' });
    }

    if (paidAmount !== undefined) {
      const numPaid = Math.max(0, Math.min(Number(paidAmount), splitItem.shareAmount));
      splitItem.paidAmount = numPaid;
      splitItem.isSettled = numPaid >= splitItem.shareAmount;
      splitItem.settledAt = splitItem.isSettled ? new Date() : null;
    } else if (isSettled !== undefined) {
      const targetStatus = Boolean(isSettled);
      splitItem.isSettled = targetStatus;
      splitItem.paidAmount = targetStatus ? splitItem.shareAmount : 0;
      splitItem.settledAt = targetStatus ? new Date() : null;
    } else {
      // Toggle
      const targetStatus = !splitItem.isSettled;
      splitItem.isSettled = targetStatus;
      splitItem.paidAmount = targetStatus ? splitItem.shareAmount : 0;
      splitItem.settledAt = targetStatus ? new Date() : null;
    }

    if (settlementNotes !== undefined) {
      splitItem.settlementNotes = settlementNotes;
    }

    await entry.save();

    return res.status(200).json({
      success: true,
      message: `Split updated successfully`,
      data: splitItem,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update settlement',
      error: error.message,
    });
  }
};

/**
 * Get comprehensive financial overview and partner balance summary
 */
export const getFinanceOverview = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.date = {};
      if (startDate) dateQuery.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.date.$lte = end;
      }
    }

    // 1. Overall Income vs Expense Totals
    const totalsAgg = await FinanceEntry.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$entryType',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    let totalExpense = 0;
    let totalIncome = 0;
    let expenseCount = 0;
    let incomeCount = 0;

    totalsAgg.forEach((item) => {
      if (item._id === 'EXPENSE') {
        totalExpense = item.totalAmount;
        expenseCount = item.count;
      } else if (item._id === 'INCOME') {
        totalIncome = item.totalAmount;
        incomeCount = item.count;
      }
    });

    const netProfitOrBurn = totalIncome - totalExpense;

    // 2. Category-wise expense breakdown
    const categoryBreakdown = await FinanceEntry.aggregate([
      { $match: { ...dateQuery, entryType: 'EXPENSE' } },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    // 3. Partner balances:
    // - Total paid upfront by partner
    // - Total share owed by partner
    // - Total settled share by partner
    // - Pending share owed
    const partners = await Partner.find({ isActive: true });
    const allSplitEntries = await FinanceEntry.find({ ...dateQuery, entryType: 'EXPENSE' });

    const partnerSummary = partners.map((p) => {
      const pIdStr = p._id.toString();

      // Total money this partner paid upfront for FlashFits
      const totalPaidUpfront = allSplitEntries
        .filter((e) => e.paidByPartner && e.paidByPartner.toString() === pIdStr)
        .reduce((sum, e) => sum + e.amount, 0);

      // All splits assigned to this partner
      let totalAssignedShare = 0;
      let totalSettledShare = 0;
      let pendingOwedShare = 0;

      allSplitEntries.forEach((entry) => {
        if (Array.isArray(entry.splits)) {
          entry.splits.forEach((split) => {
            if (split.partner && split.partner.toString() === pIdStr) {
              totalAssignedShare += split.shareAmount;
              const paid = split.paidAmount !== undefined ? split.paidAmount : (split.isSettled ? split.shareAmount : 0);
              totalSettledShare += paid;
              pendingOwedShare += Math.max(0, split.shareAmount - paid);
            }
          });
        }
      });

      // Net balance calculation:
      // (Money they paid upfront) - (Their own fair share across all expenses)
      // Positive = Partner should receive money back
      // Negative = Partner owes money to group/payer
      const netBalance = totalPaidUpfront - totalAssignedShare;

      return {
        partnerId: p._id,
        partnerName: p.name,
        phone: p.phone,
        upiId: p.upiId,
        totalPaidUpfront,
        totalAssignedShare,
        totalSettledShare,
        pendingOwedShare,
        netBalance,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        totalIncome,
        totalExpense,
        netProfitOrBurn,
        expenseCount,
        incomeCount,
        categoryBreakdown,
        partnerSummary,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate finance overview',
      error: error.message,
    });
  }
};

