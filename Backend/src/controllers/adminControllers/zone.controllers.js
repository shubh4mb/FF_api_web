import Zone from "../../models/zone.model.js";
import Merchant from "../../models/merchant.model.js";
import AppConfig from "../../models/appConfig.model.js";
import * as turf from "@turf/turf";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
/**
 * CREATE ZONE
 * @route POST /api/zones
 */
export const addZone = asyncHandler(async (req, res) => {
  const { zoneName, city, state, boundary, centerCoordinates } = req.body;

  // 1️⃣ Convert to Turf polygon
  const turfPolygon = turf.polygon(boundary.coordinates);

  // 2️⃣ Buffer by 3km from boundary
  const bufferedPolygon = turf.buffer(turfPolygon, 3, {
    units: "kilometers",
  });

  // 3️⃣ Store both boundaries
  const zone = await Zone.create({
    zoneName,
    city,
    state,
    boundary,                         // original
    deliveryBoundary: bufferedPolygon.geometry, // 🔥 new
    centerCoordinates,
  });

  // 4️⃣ Auto-sync merchants within this zone
  if (boundary && boundary.coordinates) {
    const merchantsUpdateRes = await Merchant.updateMany(
      {
        "address.location": {
          $geoWithin: {
            $geometry: boundary
          }
        }
      },
      {
        $set: {
          zoneId: zone._id,
          zoneName: zone.zoneName,
          isZoneLive: zone.status === 'Active'
        }
      }
    );
    console.log(`Auto-linked ${merchantsUpdateRes.modifiedCount} merchants to new zone: ${zoneName}`);
  }

  return res.status(201).json(
    new ApiResponse(201, { zone }, "Zone created successfully")
  );
});

/**
 * GET ALL ZONES
 * @route GET /api/zones
 */
export const getAllZones = asyncHandler(async (req, res) => {
  const zones = await Zone.find();

  return res.status(200).json(
    new ApiResponse(200, { zones }, "Zones fetched successfully")
  );
});

/**
 * GET SINGLE ZONE BY ID
 * @route GET /api/zones/:id
 */
export const getZoneById = async (req, res) => {
  try {
    const { id } = req.params;

    const zone = await Zone.findById(id);

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: zone,
    });
  } catch (error) {
    console.error("Get Zone By ID Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch zone",
      error: error.message,
    });
  }
};

/**
 * UPDATE ZONE
 * @route PUT /api/zones/:id
 */
export const updateZone = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const updateData = { ...req.body };

  // If boundary is updated, recalculate deliveryBoundary
  if (updateData.boundary && updateData.boundary.coordinates) {
    const turfPolygon = turf.polygon(updateData.boundary.coordinates);
    const bufferedPolygon = turf.buffer(turfPolygon, 3, {
      units: "kilometers",
    });
    updateData.deliveryBoundary = bufferedPolygon.geometry;
  }

  const updatedZone = await Zone.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  );

  if (!updatedZone) {
    throw new ApiError(404, "Zone not found");
  }

  // If boundary was updated, re-sync merchants
  if (updateData.boundary && updateData.boundary.coordinates) {
    await Merchant.updateMany(
      {
        "address.location": {
          $geoWithin: {
            $geometry: updatedZone.boundary
          }
        }
      },
      {
        $set: {
          zoneId: updatedZone._id,
          zoneName: updatedZone.zoneName,
          isZoneLive: updatedZone.status === 'Active'
        }
      }
    );
    console.log(`Re-linked merchants to updated zone: ${updatedZone.zoneName}`);
  }

  if (req.body.status !== undefined) {
    const isLive = updatedZone.status === 'Active';
    await Merchant.updateMany(
      { zoneId: id },
      { $set: { isZoneLive: isLive } }
    );
    console.log(`Synced isZoneLive=${isLive} for merchants in zone ${id}`);
  }

  return res.status(200).json(
    new ApiResponse(200, { zone: updatedZone }, "Zone updated successfully")
  );
});

/**
 * DELETE ZONE
 * @route DELETE /api/zones/:id
 */
export const deleteZone = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deletedZone = await Zone.findByIdAndDelete(id);

  if (!deletedZone) {
    throw new ApiError(404, "Zone not found");
  }

  return res.status(200).json(
    new ApiResponse(200, { zone: deletedZone }, "Zone deleted successfully")
  );
});

export const checkZoneOverlap = asyncHandler(async (req, res) => {
  const { polygon } = req.body;

  if (!polygon || !polygon.coordinates) {
    throw new ApiError(400, "Polygon data is required");
  }

  const overlapZone = await Zone.findOne({
    boundary: {
      $geoIntersects: {
        $geometry: polygon
      }
    }
  });

  if (overlapZone) {
    return res.status(200).json(
      new ApiResponse(200, { 
        overlap: true, 
        zone: {
          id: overlapZone._id,
          name: overlapZone.zoneName
        }
      }, "Overlap detected")
    );
  }

  return res.status(200).json(
    new ApiResponse(200, { overlap: false }, "No overlap detected")
  );
});

export const checkDeliveryAvailability = asyncHandler(async (req, res) => {
  const { lng, lat } = req.body;

  // 1️⃣ Validate input
  if (
    lng === undefined ||
    lat === undefined ||
    isNaN(lng) ||
    isNaN(lat)
  ) {
    throw new ApiError(400, "Valid longitude and latitude are required");
  }

  const userPoint = {
    type: "Point",
    coordinates: [Number(lng), Number(lat)], // [lng, lat]
  };

  // 2️⃣ Check delivery boundary (zone-based)
  const zone = await Zone.findOne({
    deliveryBoundary: {
      $geoIntersects: {
        $geometry: userPoint,
      },
    },
  }).select("zoneName city state");
  console.log("zone avail,", zone);

  // 3️⃣ Count T&B-eligible merchants within the configurable radius
  let tbAvailable = false;
  let nearbyMerchantCount = 0;
  let totalNearbyCount = 0;
  let allOffline = false;

  try {
    const config = await AppConfig.getConfig();
    const radius = config.tryAndBuyRadius || 7;
    
    const { filterMerchantsByDistance } = await import("../../helperFns/geoHelpers.js");
    
    // Fetch all potentially eligible merchants (ignore isOnline for now)
    const allPossibleMerchants = await Merchant.find({
      isActive: true,
      isVerified: true,
      isZoneLive: true,
      "address.location.coordinates": { $exists: true },
    }).select("address.location shopName isOnline").lean();

    const nearbyMerchants = filterMerchantsByDistance(
      allPossibleMerchants,
      [Number(lng), Number(lat)], // [lng, lat] — MongoDB format
      radius
    );

    totalNearbyCount = nearbyMerchants.length;
    const onlineNearby = nearbyMerchants.filter(m => m.isOnline);
    nearbyMerchantCount = onlineNearby.length;
    
    tbAvailable = nearbyMerchantCount > 0;
    allOffline = totalNearbyCount > 0 && nearbyMerchantCount === 0;

  } catch (geoErr) {
    console.error("T&B merchant count error:", geoErr);
  }

  // 4️⃣ Not serviceable (no zone)
  if (!zone) {
    return res.status(200).json(
      new ApiResponse(200, {
        serviceable: false,
        tbAvailable: false,
        allOffline: false,
        nearbyMerchantCount: 0,
        message: "Delivery not available in your area",
      }, "Not serviceable")
    );
  }

  // 5️⃣ Serviceable
  return res.status(200).json(
    new ApiResponse(200, {
      serviceable: true,
      tbAvailable,
      allOffline, // 🔥 New flag
      nearbyMerchantCount,
      totalNearbyCount, // 🔥 New count
      message: allOffline ? "All merchants are currently offline" : "Delivery available",
      zone,
    }, "Serviceable area")
  );
});
