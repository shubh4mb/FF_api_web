import Transaction from "../models/transaction.model.js";
import AuditLog from "../models/auditLog.model.js";

/**
 * Generate a clean, unique transaction reference ID.
 * Example format: TXN-LXZ89AB-K4P2
 */
export function generateTransactionId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TXN-${timestamp}-${randomPart}`;
}

/**
 * Universal helper to record any financial transaction in the platform ledger.
 *
 * @param {Object} params
 * @param {number} params.amount
 * @param {"credit"|"debit"} params.type
 * @param {string} params.category
 * @param {string} [params.source="system_auto"]
 * @param {string} [params.status="completed"]
 * @param {string} params.paymentMethod
 * @param {string} [params.referenceNumber]
 * @param {string} params.recipientType
 * @param {string} [params.recipientId]
 * @param {Object} [params.recipientDetails]
 * @param {string} [params.orderId]
 * @param {string} [params.weeklyPayoutId]
 * @param {Object} [params.receipt]
 * @param {string} [params.notes]
 * @param {Object} [params.performedBy]
 * @param {Object} [session] Optional mongoose session
 * @returns {Promise<Transaction>}
 */
export async function recordTransaction(params, session = null) {
  const transactionId = params.transactionId || generateTransactionId();

  const txnData = {
    transactionId,
    amount: Number(params.amount),
    type: params.type,
    category: params.category,
    source: params.source || "system_auto",
    status: params.status || "completed",
    paymentMethod: params.paymentMethod,
    referenceNumber: params.referenceNumber || null,
    recipientType: params.recipientType,
    recipientId: params.recipientId || null,
    recipientDetails: params.recipientDetails || {},
    orderId: params.orderId || null,
    weeklyPayoutId: params.weeklyPayoutId || null,
    receipt: params.receipt || { url: null, public_id: null },
    notes: params.notes || "",
    performedBy: params.performedBy || { adminId: null, name: "System", email: "" },
  };

  const options = session ? { session } : {};
  const [createdTxn] = await Transaction.create([txnData], options);

  // Optionally log financial audit
  try {
    const auditData = {
      orderId: txnData.orderId,
      userId: txnData.recipientType === "user" ? txnData.recipientId : null,
      merchantId: txnData.recipientType === "merchant" ? txnData.recipientId : null,
      deliveryRiderId: txnData.recipientType === "rider" ? txnData.recipientId : null,
      adminId: txnData.performedBy?.adminId || null,
      action: `TRANSACTION_${txnData.category.toUpperCase()}`,
      status: txnData.status === "completed" ? "success" : "pending",
      message: `${txnData.type === "credit" ? "Credited" : "Debited"} ₹${txnData.amount} for ${txnData.category.replace(/_/g, " ")} (${txnData.paymentMethod.toUpperCase()}) - Ref: ${txnData.referenceNumber || "N/A"}`,
      details: {
        transactionId: createdTxn.transactionId,
        amount: createdTxn.amount,
        type: createdTxn.type,
        category: createdTxn.category,
        source: createdTxn.source,
        paymentMethod: createdTxn.paymentMethod,
        referenceNumber: createdTxn.referenceNumber,
      },
    };
    await AuditLog.create([auditData], options);
  } catch (auditErr) {
    console.warn("Failed to create audit log for transaction:", auditErr.message);
  }

  return createdTxn;
}
