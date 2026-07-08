import Lead from '../../models/lead.model.js';
import Admin from '../../models/admin.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

// @desc    Create a new lead
// @route   POST /api/admin/leads
// @access  Private (Admin/Sales)
export const createLead = asyncHandler(async (req, res) => {
  const { shopName, ownerName, phoneNumber, ownerPhoneNumber, address, latitude, longitude, status, assignedTo, nextFollowUp } = req.body;

  if (!shopName || latitude === undefined || longitude === undefined) {
    throw new ApiError(400, "Shop name and map location (latitude/longitude) are required");
  }

  // Set assignment based on role
  let finalAssignedTo = req.admin._id;
  if (req.admin.role === 'superadmin' && assignedTo) {
    // If superadmin, verify the assigned user exists
    const assignedUser = await Admin.findById(assignedTo);
    if (!assignedUser) {
      throw new ApiError(404, "Assigned sales representative not found");
    }
    finalAssignedTo = assignedTo;
  }

  const lead = await Lead.create({
    shopName,
    ownerName,
    phoneNumber,
    ownerPhoneNumber,
    address,
    location: {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    },
    status: status || 'New',
    assignedTo: finalAssignedTo,
    nextFollowUp
  });

  return res.status(201).json(
    new ApiResponse(201, lead, "Lead created successfully")
  );
});

// @desc    Get all leads (filtered by role and query params)
// @route   GET /api/admin/leads
// @access  Private (Admin/Sales)
export const getLeads = asyncHandler(async (req, res) => {
  const { status, search, assignedTo } = req.query;
  const filter = {};

  // Filter by assignedTo if provided
  if (assignedTo) {
    filter.assignedTo = assignedTo;
  }

  // Filter by status
  if (status) {
    filter.status = status;
  }

  // Text search
  if (search) {
    filter.$or = [
      { shopName: { $regex: search, $options: 'i' } },
      { ownerName: { $regex: search, $options: 'i' } },
      { phoneNumber: { $regex: search, $options: 'i' } },
      { ownerPhoneNumber: { $regex: search, $options: 'i' } }
    ];
  }

  const leads = await Lead.find(filter)
    .populate('assignedTo', 'name email role')
    .sort({ updatedAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, leads, "Leads fetched successfully")
  );
});

// @desc    Get lead by ID
// @route   GET /api/admin/leads/:id
// @access  Private (Admin/Sales)
export const getLeadById = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id).populate('assignedTo', 'name email role');

  if (!lead) {
    throw new ApiError(404, "Lead not found");
  }

  // RBAC removed: all sales reps can access all leads

  return res.status(200).json(
    new ApiResponse(200, lead, "Lead details fetched successfully")
  );
});

// @desc    Update lead details
// @route   PUT /api/admin/leads/:id
// @access  Private (Admin/Sales)
export const updateLead = asyncHandler(async (req, res) => {
  const { shopName, ownerName, phoneNumber, ownerPhoneNumber, address, latitude, longitude, status, assignedTo, nextFollowUp } = req.body;
  const lead = await Lead.findById(req.params.id);

  if (!lead) {
    throw new ApiError(404, "Lead not found");
  }

  // RBAC removed: all sales reps can update all leads

  // Fields updates
  if (shopName) lead.shopName = shopName;
  if (ownerName !== undefined) lead.ownerName = ownerName;
  if (phoneNumber !== undefined) lead.phoneNumber = phoneNumber;
  if (ownerPhoneNumber !== undefined) lead.ownerPhoneNumber = ownerPhoneNumber;
  if (address !== undefined) lead.address = address;
  if (nextFollowUp !== undefined) lead.nextFollowUp = nextFollowUp;
  
  if (latitude !== undefined && longitude !== undefined) {
    lead.location = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    };
  }

  if (status) {
    lead.status = status;
  }

  if (req.admin.role === 'superadmin' && assignedTo) {
    const assignedUser = await Admin.findById(assignedTo);
    if (!assignedUser) {
      throw new ApiError(404, "Assigned sales representative not found");
    }
    lead.assignedTo = assignedTo;
  }

  await lead.save();

  return res.status(200).json(
    new ApiResponse(200, lead, "Lead updated successfully")
  );
});

// @desc    Add a communication log entry to a lead
// @route   POST /api/admin/leads/:id/logs
// @access  Private (Admin/Sales)
export const addLeadLog = asyncHandler(async (req, res) => {
  const { type, response, status, nextFollowUp } = req.body;
  const lead = await Lead.findById(req.params.id);

  if (!lead) {
    throw new ApiError(404, "Lead not found");
  }

  // RBAC removed: all sales reps can log communications for all leads

  if (!type || !response) {
    throw new ApiError(400, "Log type and response notes are required");
  }

  const logEntry = {
    type,
    response,
    date: new Date(),
    salesPerson: req.admin.name
  };

  lead.logs.push(logEntry);
  lead.lastContactedAt = new Date();

  // If status is updated via the log form, update the lead status
  if (status) {
    lead.status = status;
  }
  
  if (nextFollowUp !== undefined) {
    lead.nextFollowUp = nextFollowUp;
  }

  await lead.save();

  return res.status(201).json(
    new ApiResponse(201, lead, "Communication log added successfully")
  );
});

// @desc    Delete a lead
// @route   DELETE /api/admin/leads/:id
// @access  Private (Super Admin Only)
export const deleteLead = asyncHandler(async (req, res) => {
  if (req.admin.role !== 'superadmin') {
    throw new ApiError(403, "Only Super Admins can delete leads");
  }

  const lead = await Lead.findByIdAndDelete(req.params.id);

  if (!lead) {
    throw new ApiError(404, "Lead not found");
  }

  return res.status(200).json(
    new ApiResponse(200, null, "Lead deleted successfully")
  );
});

// @desc    Get all staff/admin members for assignment selection
// @route   GET /api/admin/leads/staff
// @access  Private (Super Admin Only)
export const getSalesRepresentatives = asyncHandler(async (req, res) => {
  const staff = await Admin.find({}).select('name email role');
  return res.status(200).json(
    new ApiResponse(200, staff, "Staff members fetched successfully")
  );
});
