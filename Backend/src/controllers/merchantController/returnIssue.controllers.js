import ReturnIssue from "../../models/returnIssue.model.js";
import Order from "../../models/order.model.js";

// Create a new return issue report
export const createReturnIssue = async (req, res) => {
  try {
    const { orderId, itemId, issueType, description } = req.body;
    const merchantId = req.merchantId;

    if (!orderId || !issueType || !description) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
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
          public_id: file.filename, // Using filename as public_id since multer-storage-cloudinary usually sets it
        });
      }
    }

    const newIssue = new ReturnIssue({
      orderId,
      merchantId,
      deliveryRiderId: order.deliveryRiderId,
      itemId: itemId || null,
      issueType,
      description,
      images,
      reportedBy: "merchant",
    });

    await newIssue.save();

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
