import User from "../../models/user.model.js";
import DeliveryRider from "../../models/deliveryRider.model.js";
import Merchant from "../../models/merchant.model.js";
import Blacklist from "../../models/blacklist.model.js";

// Block Customer (Account + IP + Device)
export const blockUser = async (req, res) => {
  try {
    const { userId, reason, ipAddress, deviceId, blockIp = true, blockDevice = true } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.isBlocked = true;
    user.blockedReason = reason || "Account suspended due to repetitive product damage or dispute abuse.";
    user.blockedAt = new Date();
    user.blockedBy = req.adminId || null;

    const ipsToBlacklist = new Set(user.blockedIps || []);
    if (ipAddress) ipsToBlacklist.add(ipAddress.trim());

    const devicesToBlacklist = new Set(user.deviceIds || []);
    if (deviceId) devicesToBlacklist.add(deviceId.trim());

    user.blockedIps = Array.from(ipsToBlacklist);
    user.deviceIds = Array.from(devicesToBlacklist);
    await user.save();

    // Insert into Blacklist collection
    const blacklistOperations = [];

    if (blockIp) {
      for (const ip of user.blockedIps) {
        if (ip) {
          blacklistOperations.push({
            updateOne: {
              filter: { type: "ip", value: ip },
              update: {
                $set: {
                  type: "ip",
                  value: ip,
                  reason: user.blockedReason,
                  sourceUserId: user._id,
                  blockedBy: req.adminId || null,
                },
              },
              upsert: true,
            },
          });
        }
      }
    }

    if (blockDevice) {
      for (const dev of user.deviceIds) {
        if (dev) {
          blacklistOperations.push({
            updateOne: {
              filter: { type: "deviceId", value: dev },
              update: {
                $set: {
                  type: "deviceId",
                  value: dev,
                  reason: user.blockedReason,
                  sourceUserId: user._id,
                  blockedBy: req.adminId || null,
                },
              },
              upsert: true,
            },
          });
        }
      }
    }

    if (blacklistOperations.length > 0) {
      await Blacklist.bulkWrite(blacklistOperations);
    }

    return res.status(200).json({
      success: true,
      message: "Customer account, IP address, and device footprint blocked successfully.",
      user: {
        _id: user._id,
        name: user.name,
        isBlocked: user.isBlocked,
        blockedReason: user.blockedReason,
        blockedIps: user.blockedIps,
        deviceIds: user.deviceIds,
      },
    });
  } catch (error) {
    console.error("Block user error:", error);
    return res.status(500).json({ success: false, message: "Failed to block user" });
  }
};

// Unblock Customer
export const unblockUser = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.isBlocked = false;
    user.blockedReason = null;
    user.blockedAt = null;
    user.blockedBy = null;
    await user.save();

    // Remove from Blacklist collection
    await Blacklist.deleteMany({ sourceUserId: user._id });

    return res.status(200).json({
      success: true,
      message: "Customer account and device footprint unblocked successfully.",
      user,
    });
  } catch (error) {
    console.error("Unblock user error:", error);
    return res.status(500).json({ success: false, message: "Failed to unblock user" });
  }
};

// Suspend Rider
export const suspendRider = async (req, res) => {
  try {
    const { riderId, reason } = req.body;

    if (!riderId) {
      return res.status(400).json({ success: false, message: "riderId is required" });
    }

    const rider = await DeliveryRider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ success: false, message: "Delivery rider not found" });
    }

    rider.status = "suspended";
    rider.isAvailable = false;
    rider.blockedReason = reason || "Rider suspended due to repetitive damage complaints during delivery.";
    rider.blockedAt = new Date();
    await rider.save();

    return res.status(200).json({
      success: true,
      message: "Delivery rider suspended successfully.",
      rider: {
        _id: rider._id,
        name: rider.fullName || rider.name,
        phone: rider.phone,
        status: rider.status,
        blockedReason: rider.blockedReason,
      },
    });
  } catch (error) {
    console.error("Suspend rider error:", error);
    return res.status(500).json({ success: false, message: "Failed to suspend rider" });
  }
};

// Unsuspend Rider
export const unsuspendRider = async (req, res) => {
  try {
    const { riderId } = req.body;

    const rider = await DeliveryRider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ success: false, message: "Delivery rider not found" });
    }

    rider.status = "active";
    rider.isAvailable = true;
    rider.blockedReason = null;
    rider.blockedAt = null;
    await rider.save();

    return res.status(200).json({
      success: true,
      message: "Delivery rider restored to active status.",
      rider,
    });
  } catch (error) {
    console.error("Unsuspend rider error:", error);
    return res.status(500).json({ success: false, message: "Failed to restore rider" });
  }
};

// Suspend Merchant
export const suspendMerchant = async (req, res) => {
  try {
    const { merchantId, reason } = req.body;

    if (!merchantId) {
      return res.status(400).json({ success: false, message: "merchantId is required" });
    }

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({ success: false, message: "Merchant not found" });
    }

    merchant.status = "suspended";
    merchant.isActive = false;
    merchant.isOnline = false;
    merchant.blockedReason = reason || "Merchant store suspended due to fraudulent claims or repeated dispute violations.";
    merchant.blockedAt = new Date();
    await merchant.save();

    return res.status(200).json({
      success: true,
      message: "Merchant store suspended successfully.",
      merchant: {
        _id: merchant._id,
        shopName: merchant.shopName,
        status: merchant.status,
        isActive: merchant.isActive,
        blockedReason: merchant.blockedReason,
      },
    });
  } catch (error) {
    console.error("Suspend merchant error:", error);
    return res.status(500).json({ success: false, message: "Failed to suspend merchant" });
  }
};

// Unsuspend Merchant
export const unsuspendMerchant = async (req, res) => {
  try {
    const { merchantId } = req.body;

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({ success: false, message: "Merchant not found" });
    }

    merchant.status = "active";
    merchant.isActive = true;
    merchant.blockedReason = null;
    merchant.blockedAt = null;
    await merchant.save();

    return res.status(200).json({
      success: true,
      message: "Merchant store restored to active status.",
      merchant,
    });
  } catch (error) {
    console.error("Unsuspend merchant error:", error);
    return res.status(500).json({ success: false, message: "Failed to restore merchant" });
  }
};
