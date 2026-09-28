import ReturnIssue from "../../models/returnIssue.model.js";
import Order from "../../models/order.model.js";
import User from "../../models/user.model.js";
import DeliveryRider from "../../models/deliveryRider.model.js";
import Merchant from "../../models/merchant.model.js";

// Create a new return issue report
export const createReturnIssue = async (req, res) => {
  try {
    const { orderId, itemId, issueType, damageCategory, description } = req.body;
    const merchantId = req.merchantId;

    if (!orderId || !description) {
      return res.status(400).json({ success: false, message: "Missing required fields (orderId, description)" });
    }

    // Verify order belongs to merchant
    const order = await Order.findOne({ _id: orderId, merchantId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    let images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        images.push({
          url: file.path,
          public_id: file.filename,
        });
      }
    }

    // Extract item details if itemId provided
    let itemDetails = null;
    if (itemId && order.items && order.items.length > 0) {
      const matchedItem = order.items.find(
        (i) => i._id?.toString() === itemId.toString() || i.productId?.toString() === itemId.toString()
      );
      if (matchedItem) {
        itemDetails = {
          name: matchedItem.name,
          size: matchedItem.size,
          price: matchedItem.price,
          image: matchedItem.image,
        };
      }
    }

    const newIssue = new ReturnIssue({
      orderId,
      merchantId,
      userId: order.userId || null,
      deliveryRiderId: order.deliveryRiderId || null,
      itemId: itemId || null,
      itemDetails: itemDetails || undefined,
      issueType: issueType || "damage",
      damageCategory: damageCategory || "other",
      description,
      images,
      reportedBy: "merchant",
    });

    await newIssue.save();

    // Link back to Order
    order.hasReportedIssue = true;
    order.returnIssueId = newIssue._id;
    await order.save();

    // Update dispute counters
    await Merchant.findByIdAndUpdate(merchantId, { $inc: { damageDisputeCount: 1 } });
    if (order.userId) {
      await User.findByIdAndUpdate(order.userId, { $inc: { incidentCount: 1 } });
    }
    if (order.deliveryRiderId) {
      await DeliveryRider.findByIdAndUpdate(order.deliveryRiderId, { $inc: { incidentCount: 1 } });
    }

    return res.status(201).json({
      success: true,
      message: "Issue reported successfully",
      issue: newIssue,
    });
  } catch (error) {
    console.error("Create return issue error:", error);
    return res.status(500).json({ success: false, message: "Failed to report issue" });
  }
};

// Get all issues reported by the merchant
export const getMerchantReturnIssues = async (req, res) => {
  try {
    const merchantId = req.merchantId;
    const issues = await ReturnIssue.find({ merchantId })
      .populate("orderId", "totalAmount orderStatus createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      issues,
    });
  } catch (error) {
    console.error("Get merchant return issues error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch issues" });
  }
};
