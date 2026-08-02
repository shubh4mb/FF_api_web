import Merchant from "../../models/merchant.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";

/**
 * Gets the list of merchants who are assigned to the current warehouse operator's warehouse.
 */
export const getAssignedMerchants = asyncHandler(async (req, res) => {
  const merchant = await Merchant.findById(req.merchantId);
  if (!merchant || merchant.accountType !== "warehouse") {
    throw new ApiError(403, "Access denied. Only warehouse operators can fetch assigned merchants.");
  }

  const warehouseId = merchant.warehouseId;
  if (!warehouseId) {
    throw new ApiError(400, "Warehouse operator does not have an assigned warehouse.");
  }

  const merchants = await Merchant.find({
    assignedWarehouseIds: warehouseId,
    warehouseStatus: "approved",
  })
    .select("_id shopName ownerName email phoneNumber")
    .lean();

  return res.status(200).json(new ApiResponse(200, { merchants }, "Assigned merchants retrieved successfully"));
});
