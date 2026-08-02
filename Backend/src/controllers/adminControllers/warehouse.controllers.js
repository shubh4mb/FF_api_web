import Warehouse from '../../models/warehouse.model.js';
import Zone from '../../models/zone.model.js';
import Merchant from '../../models/merchant.model.js';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

/**
 * POST /admin/warehouse/create
 * Create a new FlashFits warehouse
 */
export const createWarehouse = asyncHandler(async (req, res) => {
  const {
    name,
    zoneIds,
    address,
    manager,
    operatingHours,
    commissionRate,
    supportsTryAndBuy,
    supportsCourier,
  } = req.body;

  if (!name || !address?.location?.coordinates) {
    throw new ApiError(400, 'name and address.location.coordinates are required');
  }

  // Validate zones exist
  if (zoneIds && zoneIds.length > 0) {
    const zones = await Zone.find({ _id: { $in: zoneIds } });
    if (zones.length !== zoneIds.length) {
      throw new ApiError(400, 'One or more provided zoneIds do not exist');
    }
  }

  const warehouse = await Warehouse.create({
    name,
    zoneIds: zoneIds || [],
    address,
    manager,
    operatingHours,
    commissionRate: commissionRate ?? null,
    supportsTryAndBuy: supportsTryAndBuy ?? true,
    supportsCourier: supportsCourier ?? true,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, { warehouse }, 'Warehouse created successfully'));
});

/**
 * GET /admin/warehouse/all
 * List all warehouses with zone info
 */
export const getAllWarehouses = asyncHandler(async (req, res) => {
  const { isActive } = req.query;
  const filter = {};
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  const warehouses = await Warehouse.find(filter)
    .populate('zoneIds', 'zoneName city state')
    .sort({ createdAt: -1 })
    .lean();

  return res
    .status(200)
    .json(new ApiResponse(200, { warehouses }, 'Warehouses retrieved'));
});

/**
 * GET /admin/warehouse/:id
 * Get a single warehouse with full details
 */
export const getWarehouseById = asyncHandler(async (req, res) => {
  const warehouse = await Warehouse.findById(req.params.id)
    .populate('zoneIds', 'zoneName city state')
    .lean();

  if (!warehouse) throw new ApiError(404, 'Warehouse not found');

  return res
    .status(200)
    .json(new ApiResponse(200, { warehouse }, 'Warehouse retrieved'));
});

/**
 * PATCH /admin/warehouse/:id
 * Update warehouse details
 */
export const updateWarehouse = asyncHandler(async (req, res) => {
  const allowedFields = [
    'name', 'zoneIds', 'address', 'manager',
    'operatingHours', 'commissionRate',
    'supportsTryAndBuy', 'supportsCourier', 'isActive',
  ];

  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (updates.zoneIds && updates.zoneIds.length > 0) {
    const zones = await Zone.find({ _id: { $in: updates.zoneIds } });
    if (zones.length !== updates.zoneIds.length) {
      throw new ApiError(400, 'One or more provided zoneIds do not exist');
    }
  }

  const warehouse = await Warehouse.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  ).populate('zoneIds', 'zoneName city state');

  if (!warehouse) throw new ApiError(404, 'Warehouse not found');

  return res
    .status(200)
    .json(new ApiResponse(200, { warehouse }, 'Warehouse updated successfully'));
});

/**
 * DELETE /admin/warehouse/:id
 * Soft-delete a warehouse (sets isActive = false)
 */
export const deleteWarehouse = asyncHandler(async (req, res) => {
  const warehouse = await Warehouse.findByIdAndUpdate(
    req.params.id,
    { $set: { isActive: false } },
    { new: true }
  );

  if (!warehouse) throw new ApiError(404, 'Warehouse not found');

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Warehouse deactivated successfully'));
});

/**
 * POST /admin/warehouse/:warehouseId/operator
 * Create a warehouse operator account.
 * This creates a Merchant doc with accountType='warehouse' that
 * can log in via the MerchantModule and see warehouse-specific pages.
 */
export const createWarehouseOperator = asyncHandler(async (req, res) => {
  const { warehouseId } = req.params;
  const { email, password, name, phoneNumber } = req.body;

  if (!email || !password || !name) {
    throw new ApiError(400, 'email, password, and name are required');
  }

  const warehouse = await Warehouse.findById(warehouseId);
  if (!warehouse || !warehouse.isActive) {
    throw new ApiError(404, 'Warehouse not found or inactive');
  }

  // Check if email is already taken
  const existing = await Merchant.findOne({ email });
  if (existing) {
    throw new ApiError(400, 'An account with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const operator = await Merchant.create({
    shopName: warehouse.name, // use warehouse name as "shop name"
    ownerName: name,
    email,
    password: hashedPassword,
    phoneNumber: phoneNumber || '',
    accountType: 'warehouse',
    warehouseId: warehouse._id,
    isActive: true,
    isVerified: true,
    status: 'active',
    isRegistrationFeePaid: true, // no registration fee for warehouse operators
    zoneId: warehouse.zoneIds?.[0] || null,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, {
      operator: {
        id: operator._id,
        email: operator.email,
        shopName: operator.shopName,
        accountType: operator.accountType,
        warehouseId: operator.warehouseId,
      }
    }, 'Warehouse operator account created. They can now log in via the Merchant app.'));
});
