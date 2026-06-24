import AuditLog from "../models/auditLog.model.js";

/**
 * Log an audit event to the database.
 * Designed to be non-blocking and safe; it will not throw errors or disrupt caller execution.
 * 
 * @param {Object} params
 * @param {string} params.action - The log action code (e.g. PAYMENT_INITIATED)
 * @param {string} params.message - Human readable description
 * @param {string} [params.status="success"] - Action status ("success" | "failure" | "pending" | "info")
 * @param {string} [params.orderId] - Reference to Order ID
 * @param {string} [params.courierOrderId] - Reference to Courier Order ID
 * @param {string} [params.userId] - Reference to User ID
 * @param {string} [params.merchantId] - Reference to Merchant ID
 * @param {string} [params.deliveryRiderId] - Reference to Delivery Rider ID
 * @param {string} [params.adminId] - Reference to Admin ID
 * @param {Object} [params.details] - Any extra JSON payload for auditing
 * @param {Object} [params.req] - Express request object to extract IP/UserAgent/context if available
 */
export const logAuditEvent = async ({
  action,
  message,
  status = "success",
  orderId = null,
  courierOrderId = null,
  userId = null,
  merchantId = null,
  deliveryRiderId = null,
  adminId = null,
  details = null,
  req = null,
}) => {
  try {
    const logData = {
      action,
      message,
      status,
      orderId,
      courierOrderId,
      userId,
      merchantId,
      deliveryRiderId,
      adminId,
      details,
    };

    if (req) {
      logData.ipAddress = req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || null;
      logData.userAgent = req.headers["user-agent"] || null;
      
      // Auto-extract IDs from auth context objects attached to requests
      if (req.user) {
        logData.userId = logData.userId || req.user.userId;
      }
      if (req.merchant) {
        logData.merchantId = logData.merchantId || req.merchant.merchantId;
      }
      if (req.rider) {
        logData.deliveryRiderId = logData.deliveryRiderId || req.rider.riderId;
      }
      if (req.admin) {
        logData.adminId = logData.adminId || req.admin.adminId;
      }
    }

    const log = new AuditLog(logData);
    await log.save();
    return log;
  } catch (error) {
    console.error(`[AuditLogger Error] Failed to write log for action ${action}:`, error);
    // Silent catch to prevent breaking caller endpoint transactions
  }
};
