import mongoose from "mongoose";
import Merchant from "../../models/merchant.model.js";
import Zone from "../../models/zone.model.js";
import Order from "../../models/order.model.js";
import WarehouseOrder from "../../models/warehouseOrder.model.js";
import { storageService } from "../../services/storage.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { sendVerificationEmail } from "../../services/mail.service.js";
import { getRoadDistance } from "../../helperFns/orsHelper.js";
import { haversineDistance } from "../../helperFns/geoHelpers.js";
import AppConfig from "../../models/appConfig.model.js";
import { isBackendInTestMode, isTestMerchant } from "../../helperFns/testModeHelper.js";



export const addMerchant = asyncHandler(async (req, res) => {
  console.log("hiii");
  
  // Sanitize genderCategory: handle array or comma-separated string
  if (req.body.genderCategory) {
    if (typeof req.body.genderCategory === 'string') {
      req.body.genderCategory = req.body.genderCategory.split(',').map(item => item.trim());
    } else if (!Array.isArray(req.body.genderCategory)) {
      req.body.genderCategory = [req.body.genderCategory];
    }
  }

  const merchant = new Merchant(req.body);
  
  if (req.body.zoneId) {
    const zone = await Zone.findById(req.body.zoneId).lean();
    if (zone) {
      merchant.isZoneLive = zone.status === 'Active';
    }
  }
  if (!req.files || !req.files['logo']) {
    throw new ApiError(400, "Logo is required");
  }

  const imageDetails = await storageService.uploadSingle(req.files['logo'], 'merchant/logo');
  let bgImageDetails = null;

  if (req.files['backgroundImage']) {
    bgImageDetails = await storageService.uploadSingle(req.files['backgroundImage'], 'merchant/background');
  }

  merchant.logo = imageDetails;
  if (bgImageDetails) merchant.backgroundImage = bgImageDetails;
  await merchant.save();
  return res.status(201).json(new ApiResponse(201, { merchant }, "Merchant created successfully"));
});

export const getMerchants = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = status ? { status } : {};

  const merchants = await Merchant.find(query)
    .select('shopName phoneNumber email isActive status logo rating reviewCount address operatingHours genderCategory zoneName zoneId stats isOnline isVerified fulfillmentType warehouseStatus isStoreActive createdAt updatedAt')
    .lean();
  return res.status(200).json(new ApiResponse(200, { merchants }, "Merchants retrieved successfully"));
});

export const getMerchantById = asyncHandler(async (req, res) => {
  let merchant = await Merchant.findById(req.params.id)
    .populate('assignedWarehouseIds', 'name code address operatingHours')
    .populate('warehouseAssignments.warehouseId', 'name code address operatingHours')
    .lean();
  if (!merchant) {
    try {
      const Warehouse = (await import("../../models/warehouse.model.js")).default;
      let warehouse = null;
      if (mongoose.Types.ObjectId.isValid(req.params.id)) {
        warehouse = await Warehouse.findById(req.params.id).lean();
      }
      if (warehouse || req.params.id === 'ff-warehouse-hub' || req.params.id === 'warehouse' || req.params.id?.includes('warehouse')) {
        const ProductFlat = (await import("../../models/productFlat.model.js")).default;
        const whFilter = { source: 'warehouse', isActive: true, isDeleted: { $ne: true } };
        const uniqueWhProducts = (await ProductFlat.distinct('styleGroupId', whFilter)).filter(Boolean);
        const count = uniqueWhProducts.length;
        const stockAgg = await ProductFlat.aggregate([
          { $match: whFilter },
          { $group: { _id: null, totalStock: { $sum: '$stock' } } }
        ]);
        const totalStock = stockAgg[0]?.totalStock || 0;
        const virtualMerchant = {
          _id: warehouse ? warehouse._id.toString() : 'ff-warehouse-hub',
          shopName: warehouse?.name || 'FlashFits Warehouse Hub',
          logo: { url: '' },
          backgroundImage: { url: '' },
          genderCategory: ['MEN', 'WOMEN', 'KIDS', 'BOYS', 'GIRLS'],
          shipsWithinHours: 1,
          isOnline: true,
          isZoneLive: true,
          isVerified: true,
          isActive: true,
          isNearby: true,
          isWarehouse: true,
          rating: 4.9,
          address: warehouse?.address || { city: 'FlashFits Hub', area: 'FlashFits Hub' },
          distanceKm: 2.5,
          durationMins: 20,
          stats: { totalProducts: count, totalStock },
        };
        return res.status(200).json(new ApiResponse(200, { merchant: virtualMerchant }, "Warehouse retrieved as merchant"));
      }
    } catch (whErr) {
      console.error('Error fetching warehouse as merchant:', whErr);
    }
    throw new ApiError(404, "Merchant not found");
  }

  // Normalize warehouseAssignments so all assigned warehouses have a status object
  if (merchant) {
    const rawAssignments = merchant.warehouseAssignments || [];
    const assignmentMap = new Map();
    rawAssignments.forEach(wa => {
      const wId = (wa.warehouseId?._id || wa.warehouseId)?.toString();
      if (wId) assignmentMap.set(wId, wa);
    });

    (merchant.assignedWarehouseIds || []).forEach(wh => {
      const whId = (wh?._id || wh)?.toString();
      if (whId && !assignmentMap.has(whId)) {
        rawAssignments.push({
          warehouseId: wh,
          isActive: true,
          deactivatedAt: null,
          reason: ''
        });
      }
    });
    merchant.warehouseAssignments = rawAssignments;
  }

  // For warehouse-only brands, resolve fulfillment location from the assigned warehouse hub
  if (merchant.fulfillmentType === 'warehouse') {
    merchant.isWarehouse = true;
    try {
      const Warehouse = (await import("../../models/warehouse.model.js")).default;
      let wh = null;
      if (merchant.assignedWarehouseIds && merchant.assignedWarehouseIds.length > 0) {
        const firstWh = merchant.assignedWarehouseIds[0];
        const firstWhId = firstWh?._id || firstWh;
        wh = await Warehouse.findById(firstWhId).lean();
      }
      if (!wh) {
        wh = await Warehouse.findOne({ isActive: true }).lean();
      }
      if (wh) {
        merchant.warehouseName = wh.name;
        merchant.warehouseId = wh._id;
        if (wh.address?.location?.coordinates) {
          merchant.effectiveLocation = wh.address.location;
        }
      }
    } catch (e) {
      console.warn("Could not attach warehouse to warehouse merchant:", e.message);
    }
  }

  // Ensure total product count is fresh (count unique styleGroups, not individual stock/variant rows)
  try {
    const ProductFlat = (await import("../../models/productFlat.model.js")).default;
    const filter = { 
      merchantId: merchant._id, 
      isActive: true, 
      isDeleted: { $ne: true },
      isVerified: true 
    };
    if (merchant.fulfillmentType === 'warehouse' || merchant.isWarehouse) {
      delete filter.merchantId;
      filter.$or = [{ merchantId: merchant._id }, { source: 'warehouse' }];
    }
    const uniqueProductIds = (await ProductFlat.distinct('styleGroupId', filter)).filter(Boolean);
    const totalCount = uniqueProductIds.length;

    const stockAgg = await ProductFlat.aggregate([
      { $match: filter },
      { $group: { _id: null, totalStock: { $sum: '$stock' } } }
    ]);
    const totalStock = stockAgg[0]?.totalStock || 0;

    merchant.stats = { 
      ...(merchant.stats || {}), 
      totalProducts: totalCount,
      totalStock
    };
  } catch (e) {
    // Ignore stat count error
  }

  // Calculate distance if lat and lng are provided in request query
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const targetLocation = merchant.effectiveLocation || merchant.address?.location;

  if (!isNaN(lat) && !isNaN(lng) && targetLocation?.coordinates) {
    const userCoords = [lng, lat]; // [longitude, latitude]
    const merchantCoords = targetLocation.coordinates; // [longitude, latitude]
    
    // 1. Quick straight-line displacement check (Haversine)
    const displacementKm = haversineDistance(lat, lng, merchantCoords[1], merchantCoords[0]);
    
    let roadDistanceKm = null;
    let durationMins = null;
    
    // Only query ORS if within a reasonable distance (e.g. 30km)
    if (displacementKm <= 30) {
      const roadResult = await getRoadDistance(userCoords, merchantCoords);
      roadDistanceKm = roadResult?.distanceKm ?? null;
      durationMins = roadResult?.durationMins ?? null;
    }
    
    // Fallback if ORS fails or is skipped
    if (roadDistanceKm === null) {
      roadDistanceKm = displacementKm;
      durationMins = Math.ceil(5 + (displacementKm * 2.5));
    }
    
    const config = await AppConfig.getConfig();
    const tryAndBuyRadius = config.tryAndBuyRadius;
    const isNearby = roadDistanceKm <= tryAndBuyRadius;

    merchant.distanceKm = Number(roadDistanceKm.toFixed(2));
    merchant.durationMins = durationMins;
    merchant.isNearby = isNearby && (merchant.fulfillmentType === 'warehouse' ? true : (merchant.isOnline && merchant.isZoneLive));
  }

  return res.status(200).json(new ApiResponse(200, { merchant }, "Merchant retrieved successfully"));
});

export const updateMerchantById = asyncHandler(async (req, res) => {
  let imageDetails = null;
  let bgImageDetails = null;

  if (req.files && req.files['logo']) {
    const imageDetails = await storageService.uploadSingle(req.files['logo'], 'merchant/logo');
    if (imageDetails) req.body.logo = imageDetails;
  }

  if (req.files && req.files['backgroundImage']) {
    const bgImageDetails = await storageService.uploadSingle(req.files['backgroundImage'], 'merchant/background');
    if (bgImageDetails) req.body.backgroundImage = bgImageDetails;
  }

  let updateData = { ...req.body };

  // Sanitize genderCategory: handle array or JSON/comma-separated string
  if (updateData.genderCategory) {
    if (typeof updateData.genderCategory === 'string') {
      try {
        const parsed = JSON.parse(updateData.genderCategory);
        updateData.genderCategory = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        updateData.genderCategory = updateData.genderCategory.split(',').map(item => item.trim());
      }
    } else if (!Array.isArray(updateData.genderCategory)) {
      updateData.genderCategory = [updateData.genderCategory];
    }
  }

  // Sanitize category: handle array or JSON/comma-separated string
  if (updateData.category || updateData['category[]']) {
    let cat = updateData.category || updateData['category[]'];
    if (typeof cat === 'string') {
      try {
        const parsed = JSON.parse(cat);
        cat = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        cat = cat.split(',').map(item => item.trim());
      }
    } else if (!Array.isArray(cat)) {
      cat = [cat];
    }
    updateData.category = cat;
    delete updateData['category[]'];
  }

  // Sanitize address: parse if JSON string and guarantee GeoJSON Point
  if (updateData.address) {
    let addressObj = updateData.address;
    if (typeof addressObj === 'string') {
      try {
        addressObj = JSON.parse(addressObj);
      } catch (err) {
        console.error("Failed to parse address in updateMerchantById:", err);
      }
    }
    if (typeof addressObj === 'object' && addressObj !== null) {
      const lat = addressObj.latitude ?? addressObj.location?.coordinates?.[1];
      const lng = addressObj.longitude ?? addressObj.location?.coordinates?.[0];
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      if (!isNaN(latNum) && !isNaN(lngNum)) {
        addressObj.latitude = latNum;
        addressObj.longitude = lngNum;
        addressObj.location = {
          type: "Point",
          coordinates: [lngNum, latNum], // [lng, lat] GeoJSON standard
        };
      }
      updateData.address = addressObj;
    }
  }

  // Sanitize operatingHours: parse if JSON string and map open/close
  if (updateData.operatingHours) {
    let hoursObj = updateData.operatingHours;
    if (typeof hoursObj === 'string') {
      try {
        hoursObj = JSON.parse(hoursObj);
      } catch (err) {
        console.error("Failed to parse operatingHours in updateMerchantById:", err);
      }
    }
    if (typeof hoursObj === 'object' && hoursObj !== null) {
      updateData.operatingHours = {
        open: hoursObj.open || hoursObj.openTime || "09:00",
        close: hoursObj.close || hoursObj.closeTime || "21:00",
        daysOpen: Array.isArray(hoursObj.daysOpen) ? hoursObj.daysOpen : [],
      };
    }
  }

  // Handle warehouse assignment
  let updateOperation = { $set: updateData };

  if (req.body.warehouseId) {
    updateOperation.$addToSet = { assignedWarehouseIds: req.body.warehouseId };
    delete updateData.warehouseId; // Remove from $set since it's an operator field, not on merchant directly in this context
  }

  const merchant = await Merchant.findByIdAndUpdate(req.params.id, updateOperation, { new: true });
  if (!merchant) {
    throw new ApiError(404, "Merchant not found");
  }

  // If zone changed, sync the isZoneLive status
  if (req.body.zoneId) {
    const zone = await Zone.findById(req.body.zoneId).lean();
    if (zone) {
      merchant.isZoneLive = zone.status === 'Active';
      await merchant.save();
    }
  }

  return res.status(200).json(new ApiResponse(200, { merchant }, "Merchant updated successfully"));
});

export const verifyMerchant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isVerified, kycVerifications, rejectionReason, status } = req.body;

  let updateQuery = {};
  if (status !== undefined) {
    updateQuery.status = status;
    if (status === 'active') {
      updateQuery.isActive = true;
      updateQuery.isVerified = true;
      updateQuery.rejectionReason = "";
    } else if (status === 'rejected' || status === 'suspended') {
      updateQuery.isActive = false;
      if (rejectionReason) updateQuery.rejectionReason = rejectionReason;
    } else if (status === 'pending_payment') {
      updateQuery.isVerified = true;
      updateQuery.isActive = false;
      updateQuery.rejectionReason = "";
    }
  } else if (isVerified !== undefined) {
    updateQuery.isVerified = !!isVerified;
    if (!!isVerified) {
      const merchant = await Merchant.findById(id);
      if (merchant && (merchant.isRegistrationFeePaid || merchant.status === 'payment_pending_verification')) {
        updateQuery.status = 'active';
        updateQuery.isActive = true;
      } else {
        updateQuery.status = 'pending_payment';
        updateQuery.isActive = false;
      }
      updateQuery.rejectionReason = "";
    } else {
      updateQuery.status = 'rejected';
      updateQuery.isActive = false;
      updateQuery.rejectionReason = rejectionReason || "Your document verification failed.";
    }
  }

  if (kycVerifications) {
    if (kycVerifications.pan !== undefined) updateQuery['kyc.pan.verified'] = !!kycVerifications.pan;
    if (kycVerifications.gst !== undefined) updateQuery['kyc.gst.verified'] = !!kycVerifications.gst;
    if (kycVerifications.businessProof !== undefined) updateQuery['kyc.businessProof.verified'] = !!kycVerifications.businessProof;
    if (kycVerifications.bankProof !== undefined) updateQuery['kyc.bankProof.verified'] = !!kycVerifications.bankProof;
    if (kycVerifications.bankDetails !== undefined) updateQuery['bankDetails.isBankVerified'] = !!kycVerifications.bankDetails;
  }

  const merchant = await Merchant.findByIdAndUpdate(
    id,
    { $set: updateQuery },
    { new: true }
  );

  if (!merchant) {
    throw new ApiError(404, "Merchant not found");
  }

  // Check if all KYC items are verified to update isKycVerified flag
  const isKycComplete = !!(
    merchant.kyc?.pan?.verified &&
    merchant.kyc?.businessProof?.verified &&
    merchant.kyc?.bankProof?.verified
  );
  if (merchant.kyc?.isKycVerified !== isKycComplete) {
    merchant.kyc.isKycVerified = isKycComplete;
    await merchant.save();
  }

  // Trigger email notification if verified
  if (isVerified || status === 'active') {
    try {
      await sendVerificationEmail(merchant.email, merchant.shopName);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // We don't throw here to avoid failing the verification itself
    }
  }

  return res.status(200).json(
    new ApiResponse(200, { merchant }, `Merchant updated successfully`)
  );
});

/**
 * PATCH /admin/merchant/:id/warehouse/:warehouseId/toggle-status
 * Toggle brand active status in a specific warehouse and cascade to ProductFlat
 */
export const toggleMerchantWarehouseStatus = asyncHandler(async (req, res) => {
  const { id, warehouseId } = req.params;
  const { isActive, reason } = req.body;

  const merchant = await Merchant.findById(id);
  if (!merchant) throw new ApiError(404, "Merchant not found");

  const Warehouse = (await import("../../models/warehouse.model.js")).default;
  const wh = await Warehouse.findById(warehouseId);
  if (!wh) throw new ApiError(404, "Warehouse not found");

  // Ensure assignedWarehouseIds contains this warehouse
  if (!merchant.assignedWarehouseIds) merchant.assignedWarehouseIds = [];
  if (!merchant.assignedWarehouseIds.some(w => w.toString() === warehouseId.toString())) {
    merchant.assignedWarehouseIds.push(warehouseId);
  }

  if (!merchant.warehouseAssignments) merchant.warehouseAssignments = [];
  const existingIndex = merchant.warehouseAssignments.findIndex(
    wa => wa.warehouseId.toString() === warehouseId.toString()
  );

  const newStatus = isActive !== undefined ? !!isActive : true;

  if (existingIndex > -1) {
    merchant.warehouseAssignments[existingIndex].isActive = newStatus;
    merchant.warehouseAssignments[existingIndex].deactivatedAt = newStatus ? null : new Date();
    if (reason !== undefined) merchant.warehouseAssignments[existingIndex].reason = reason;
  } else {
    merchant.warehouseAssignments.push({
      warehouseId,
      isActive: newStatus,
      deactivatedAt: newStatus ? null : new Date(),
      reason: reason || ''
    });
  }

  await merchant.save();

  // Cascade to ProductFlat in this warehouse only!
  const ProductFlat = (await import("../../models/productFlat.model.js")).default;
  const filter = {
    merchantId: merchant._id,
    warehouseId: wh._id,
    source: 'warehouse'
  };
  if (newStatus) {
    filter.isDeleted = { $ne: true };
  }

  const updateRes = await ProductFlat.updateMany(filter, { $set: { isActive: newStatus } });

  // Re-fetch populated merchant
  const updatedMerchant = await Merchant.findById(id)
    .populate('assignedWarehouseIds', 'name code address operatingHours')
    .populate('warehouseAssignments.warehouseId', 'name code address operatingHours')
    .lean();

  return res.status(200).json(new ApiResponse(200, {
    merchant: updatedMerchant,
    productsAffected: updateRes.modifiedCount,
    status: newStatus ? 'activated' : 'deactivated'
  }, `Brand successfully ${newStatus ? 'activated' : 'deactivated'} in ${wh.name}`));
});

/**
 * POST /admin/merchant/:id/warehouse/assign
 * Assign a merchant to a warehouse with active status
 */
export const assignWarehouseToMerchant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { warehouseId } = req.body;

  if (!warehouseId) throw new ApiError(400, "warehouseId is required");

  const merchant = await Merchant.findById(id);
  if (!merchant) throw new ApiError(404, "Merchant not found");

  const Warehouse = (await import("../../models/warehouse.model.js")).default;
  const wh = await Warehouse.findById(warehouseId);
  if (!wh) throw new ApiError(404, "Warehouse not found");

  if (!merchant.assignedWarehouseIds) merchant.assignedWarehouseIds = [];
  if (!merchant.assignedWarehouseIds.some(w => w.toString() === warehouseId.toString())) {
    merchant.assignedWarehouseIds.push(warehouseId);
  }

  if (!merchant.warehouseAssignments) merchant.warehouseAssignments = [];
  if (!merchant.warehouseAssignments.some(wa => wa.warehouseId.toString() === warehouseId.toString())) {
    merchant.warehouseAssignments.push({
      warehouseId,
      isActive: true,
      deactivatedAt: null,
      reason: ''
    });
  }

  if (merchant.warehouseStatus !== 'approved') {
    merchant.warehouseStatus = 'approved';
  }

  await merchant.save();

  const updatedMerchant = await Merchant.findById(id)
    .populate('assignedWarehouseIds', 'name code address operatingHours')
    .populate('warehouseAssignments.warehouseId', 'name code address operatingHours')
    .lean();

  return res.status(200).json(new ApiResponse(200, { merchant: updatedMerchant }, `Assigned to ${wh.name} successfully`));
});

/**
 * DELETE /admin/merchant/:id/warehouse/:warehouseId
 * Remove merchant's warehouse assignment and deactivate warehouse stock
 */
export const removeWarehouseFromMerchant = asyncHandler(async (req, res) => {
  const { id, warehouseId } = req.params;

  const merchant = await Merchant.findById(id);
  if (!merchant) throw new ApiError(404, "Merchant not found");

  merchant.assignedWarehouseIds = (merchant.assignedWarehouseIds || []).filter(
    w => w.toString() !== warehouseId.toString()
  );
  merchant.warehouseAssignments = (merchant.warehouseAssignments || []).filter(
    wa => wa.warehouseId.toString() !== warehouseId.toString()
  );

  if (merchant.assignedWarehouseIds.length === 0) {
    merchant.warehouseStatus = 'none';
  }

  await merchant.save();

  // Also deactivate any warehouse products in this warehouse
  const ProductFlat = (await import("../../models/productFlat.model.js")).default;
  await ProductFlat.updateMany(
    { merchantId: merchant._id, warehouseId, source: 'warehouse' },
    { $set: { isActive: false } }
  );

  const updatedMerchant = await Merchant.findById(id)
    .populate('assignedWarehouseIds', 'name code address operatingHours')
    .populate('warehouseAssignments.warehouseId', 'name code address operatingHours')
    .lean();

  return res.status(200).json(new ApiResponse(200, { merchant: updatedMerchant }, "Warehouse assignment removed"));
});

/**
 * PATCH /admin/merchant/:id/toggle-store-status
 * Toggle physical retail store visibility on customer app without affecting warehouse brand consignment
 */
export const toggleMerchantStoreStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isStoreActive } = req.body;

  const merchant = await Merchant.findById(id);
  if (!merchant) throw new ApiError(404, "Merchant not found");

  const currentStoreActive = merchant.isStoreActive !== false;
  const newStoreStatus = isStoreActive !== undefined ? !!isStoreActive : !currentStoreActive;

  merchant.isStoreActive = newStoreStatus;
  await merchant.save();

  // Cascade to physical store direct products only (source !== 'warehouse')
  const ProductFlat = (await import("../../models/productFlat.model.js")).default;
  const directFilter = {
    merchantId: merchant._id,
    source: { $ne: 'warehouse' },
    isDeleted: { $ne: true }
  };

  const updateResult = await ProductFlat.updateMany(directFilter, {
    $set: { isActive: newStoreStatus }
  });

  const updatedMerchant = await Merchant.findById(id)
    .populate('assignedWarehouseIds', 'name code address operatingHours')
    .populate('warehouseAssignments.warehouseId', 'name code address operatingHours')
    .lean();

  return res.status(200).json(new ApiResponse(200, {
    merchant: updatedMerchant,
    isStoreActive: newStoreStatus,
    productsAffected: updateResult.modifiedCount
  }, `Physical store has been ${newStoreStatus ? 'activated (Live)' : 'hidden from customer app'}`));
});

/**
 * GET /admin/merchant-status-overview
 * Retrieve comprehensive merchant online/offline statuses, socket connectivity, and stats
 */
export const getMerchantStatusOverview = asyncHandler(async (req, res) => {
  const activeOrderStatuses = [
    'placed',
    'accepted',
    'packed',
    'in_transit',
    'try_phase',
    'selection_made',
    'return_in_progress'
  ];

  const [merchants, activeOrders, activeWarehouseOrders] = await Promise.all([
    Merchant.find({})
      .select('shopName phoneNumber email logo address zoneName zoneId isOnline isVerified isActive status operatingHours fulfillmentType warehouseStatus isStoreActive createdAt updatedAt')
      .sort({ isOnline: -1, shopName: 1 })
      .lean(),
    Order.find({ orderStatus: { $in: activeOrderStatuses } })
      .select('_id merchantId orderStatus totalAmount items createdAt userId deliveryRiderId customerDeliveryStatus deliveryMode')
      .populate('userId', 'name phoneNumber')
      .populate('deliveryRiderId', 'name phone')
      .sort({ createdAt: -1 })
      .lean(),
    WarehouseOrder.find({ orderStatus: { $in: activeOrderStatuses } })
      .select('_id sourceMerchantId warehouseId orderStatus totalAmount items createdAt userId deliveryRiderId fulfillmentType')
      .populate('userId', 'name phoneNumber')
      .populate('deliveryRiderId', 'name phone')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  // Group active orders by merchant
  const ordersByMerchant = new Map();

  const pushOrder = (mIdStr, orderData) => {
    if (!mIdStr) return;
    if (!ordersByMerchant.has(mIdStr)) {
      ordersByMerchant.set(mIdStr, []);
    }
    ordersByMerchant.get(mIdStr).push(orderData);
  };

  activeOrders.forEach(o => {
    const mIdStr = o.merchantId?.toString();
    pushOrder(mIdStr, {
      _id: o._id,
      orderCode: `#${o._id.toString().slice(-5).toUpperCase()}`,
      orderStatus: o.orderStatus,
      totalAmount: o.totalAmount,
      itemCount: o.items?.length || 0,
      customerName: o.userId?.name || 'Customer',
      customerPhone: o.userId?.phoneNumber || null,
      riderName: o.deliveryRiderId?.name || null,
      riderPhone: o.deliveryRiderId?.phone || null,
      deliveryMode: o.deliveryMode,
      createdAt: o.createdAt,
      isWarehouse: false
    });
  });

  activeWarehouseOrders.forEach(wo => {
    const mIdStr = wo.sourceMerchantId?.toString() || wo.warehouseId?.toString();
    pushOrder(mIdStr, {
      _id: wo._id,
      orderCode: `#${wo._id.toString().slice(-5).toUpperCase()}`,
      orderStatus: wo.orderStatus,
      totalAmount: wo.totalAmount,
      itemCount: wo.items?.length || 0,
      customerName: wo.userId?.name || 'Customer',
      customerPhone: wo.userId?.phoneNumber || null,
      riderName: wo.deliveryRiderId?.name || null,
      riderPhone: wo.deliveryRiderId?.phone || null,
      fulfillmentType: wo.fulfillmentType,
      createdAt: wo.createdAt,
      isWarehouse: true
    });
  });

  let io = null;
  try {
    const { getIO } = await import("../../config/socket.js");
    io = getIO();
  } catch {}

  const enrichedMerchants = await Promise.all(
    merchants.map(async (m) => {
      const mId = m._id.toString();
      let isSocketConnected = false;
      if (io && io.sockets?.adapter?.rooms) {
        const room = io.sockets.adapter.rooms.get(`merchant:${mId}`);
        isSocketConnected = !!(room && room.size > 0);
      }

      let lastSeenAt = null;
      try {
        const { getMerchantMeta } = await import("../../helperFns/merchantFns.js");
        const meta = await getMerchantMeta(mId);
        if (meta?.lastSeenAt) lastSeenAt = meta.lastSeenAt;
      } catch {}

      const merchantOrders = ordersByMerchant.get(mId) || [];

      return {
        ...m,
        isSocketConnected,
        lastSeenAt,
        activeOrdersCount: merchantOrders.length,
        currentOrders: merchantOrders
      };
    })
  );

  const totalMerchants = enrichedMerchants.length;
  const onlineCount = enrichedMerchants.filter(m => m.isOnline).length;
  const offlineCount = totalMerchants - onlineCount;
  const socketConnectedCount = enrichedMerchants.filter(m => m.isSocketConnected).length;
  const totalActiveOrders = activeOrders.length + activeWarehouseOrders.length;
  const merchantsWithOrdersCount = enrichedMerchants.filter(m => m.activeOrdersCount > 0).length;

  return res.status(200).json(new ApiResponse(200, {
    merchants: enrichedMerchants,
    stats: {
      totalMerchants,
      onlineCount,
      offlineCount,
      socketConnectedCount,
      totalActiveOrders,
      merchantsWithOrdersCount
    }
  }, "Merchant status overview retrieved successfully"));
});

/**
 * PATCH /admin/merchant/:id/toggle-online
 * Toggle a merchant's online/offline status, update Redis, and emit real-time socket updates
 */
export const toggleMerchantOnlineStatusAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isOnline } = req.body;

  const merchant = await Merchant.findById(id);
  if (!merchant) {
    throw new ApiError(404, "Merchant not found");
  }

  const newStatus = isOnline !== undefined ? !!isOnline : !merchant.isOnline;
  merchant.isOnline = newStatus;
  await merchant.save();

  // Sync to Redis
  try {
    const { setMerchantMeta } = await import("../../helperFns/merchantFns.js");
    await setMerchantMeta(id, { isOnline: String(newStatus), lastSeenAt: Date.now() });
  } catch (redisErr) {
    console.error("Failed to sync toggle to Redis in admin:", redisErr);
  }

  // Real-time socket broadcast
  try {
    const { getIO } = await import("../../config/socket.js");
    const io = getIO();
    if (io) {
      // Notify the specific merchant mobile app
      io.to(`merchant:${id}`).emit("onlineStatusUpdated", {
        isOnline: newStatus,
        merchantId: id
      });

      // Broadcast to admin dashboard listeners
      const statusPayload = {
        merchantId: id,
        shopName: merchant.shopName,
        isOnline: newStatus,
        updatedAt: new Date().toISOString()
      };
      io.to("admin").emit("admin:merchantStatusChanged", statusPayload);
      io.to("admin:orders").emit("admin:merchantStatusChanged", statusPayload);
    }
  } catch (sockErr) {
    console.warn("Socket notification skipped in toggleMerchantOnlineStatusAdmin:", sockErr?.message);
  }

  return res.status(200).json(new ApiResponse(200, {
    merchant: {
      _id: merchant._id,
      shopName: merchant.shopName,
      isOnline: merchant.isOnline,
      zoneName: merchant.zoneName,
      updatedAt: merchant.updatedAt
    }
  }, `Merchant "${merchant.shopName}" is now ${newStatus ? 'ONLINE' : 'OFFLINE'}`));
});

/**
 * PATCH /admin/merchants/bulk-toggle-online
 * Bulk toggle online/offline status for multiple merchants
 */
export const bulkToggleMerchantOnlineStatusAdmin = asyncHandler(async (req, res) => {
  const { merchantIds, isOnline } = req.body;

  if (!Array.isArray(merchantIds) || merchantIds.length === 0) {
    throw new ApiError(400, "merchantIds array is required");
  }

  const targetStatus = !!isOnline;
  const result = await Merchant.updateMany(
    { _id: { $in: merchantIds } },
    { $set: { isOnline: targetStatus } }
  );

  // Sync to Redis and sockets
  try {
    const { setMerchantMeta } = await import("../../helperFns/merchantFns.js");
    const { getIO } = await import("../../config/socket.js");
    let io = null;
    try { io = getIO(); } catch {}

    for (const mId of merchantIds) {
      await setMerchantMeta(mId, { isOnline: String(targetStatus), lastSeenAt: Date.now() }).catch(() => {});
      if (io) {
        io.to(`merchant:${mId}`).emit("onlineStatusUpdated", { isOnline: targetStatus, merchantId: mId });
      }
    }

    if (io) {
      const bulkPayload = {
        merchantIds,
        isOnline: targetStatus,
        count: result.modifiedCount,
        updatedAt: new Date().toISOString()
      };
      io.to("admin").emit("admin:bulkMerchantStatusChanged", bulkPayload);
      io.to("admin:orders").emit("admin:bulkMerchantStatusChanged", bulkPayload);
    }
  } catch (err) {
    console.error("Bulk sync error:", err);
  }

  return res.status(200).json(new ApiResponse(200, {
    modifiedCount: result.modifiedCount,
    isOnline: targetStatus
  }, `Successfully updated ${result.modifiedCount} merchants to ${targetStatus ? 'ONLINE' : 'OFFLINE'}`));
});