import AuditLog from "../../models/auditLog.model.js";

/**
 * Get audit logs for the admin dashboard
 */
export const getAuditLogs = async (req, res) => {
  try {
    const { action, status, orderId, userId, merchantId, deliveryRiderId, search, page = 1, limit = 50 } = req.query;
    
    const filter = {};
    
    if (action) {
      filter.action = action;
    }
    if (status) {
      filter.status = status;
    }
    if (orderId) {
      filter.orderId = orderId;
    }
    if (userId) {
      filter.userId = userId;
    }
    if (merchantId) {
      filter.merchantId = merchantId;
    }
    if (deliveryRiderId) {
      filter.deliveryRiderId = deliveryRiderId;
    }
    
    if (search) {
      filter.$or = [
        { message: { $regex: search, $options: "i" } },
        { action: { $regex: search, $options: "i" } },
      ];
    }
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skipNum = (pageNum - 1) * limitNum;
    
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skipNum)
        .limit(limitNum)
        .populate("userId", "name phone email")
        .populate("merchantId", "shopName shopAddress phoneNumber")
        .populate("deliveryRiderId", "name phone")
        .populate("adminId", "name role")
        .populate({
          path: "orderId",
          select: "orderStatus paymentStatus totalPayable totalAmount razorpayOrderId razorpayPaymentId items"
        })
        .populate({
          path: "courierOrderId",
          select: "orderStatus paymentStatus totalPayable totalAmount razorpayOrderId razorpayPaymentId items"
        })
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
    
    return res.status(200).json({
      success: true,
      logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      }
    });
  } catch (error) {
    console.error("Error in getAuditLogs controller:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};
