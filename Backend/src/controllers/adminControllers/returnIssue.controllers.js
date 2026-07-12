import ReturnIssue from "../../models/returnIssue.model.js";

// Get all return issues
export const getAllReturnIssues = async (req, res) => {
  try {
    const { status, merchantId, page = 1, limit = 30 } = req.query;
    
    let filter = {};
    if (status) filter.status = status;
    if (merchantId) filter.merchantId = merchantId;

    const skip = (page - 1) * limit;

    const [issues, total] = await Promise.all([
      ReturnIssue.find(filter)
        .populate("merchantId", "shopName email")
        .populate("orderId", "totalAmount orderStatus")
        .populate("deliveryRiderId", "name phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ReturnIssue.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      issues,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all return issues error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch issues" });
  }
};

// Update issue status
export const updateReturnIssueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNotes } = req.body;

    if (!["pending", "investigating", "resolved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const issue = await ReturnIssue.findByIdAndUpdate(
      id,
      { status, resolutionNotes },
      { new: true }
    );

    if (!issue) {
      return res.status(404).json({ success: false, message: "Issue not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Issue updated successfully",
      issue,
    });
  } catch (error) {
    console.error("Update return issue error:", error);
    return res.status(500).json({ success: false, message: "Failed to update issue" });
  }
};
