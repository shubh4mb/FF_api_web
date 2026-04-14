import Collection from '../../models/collection.model.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { storageService } from '../../services/storage.service.js';

// Create a new collection
export const createCollection = asyncHandler(async (req, res) => {
  try {
    const { name, description, priority, isActive } = req.body || {};

    if (!req.body || !name) {
      console.error('Body missing in createCollection:', req.body);
      throw new ApiError(400, "Collection data (name) is required");
    }

    let bannerImage = { public_id: '', url: '' };

    if (req.file) {
      const uploadResult = await storageService.uploadSingle(req.file, 'collections');
      bannerImage = {
        public_id: uploadResult.public_id,
        url: uploadResult.url
      };
    }

    const collection = await Collection.create({
      name,
      description,
      bannerImage,
      priority: priority ? Number(priority) : 0,
      isActive: isActive === 'true' || isActive === true,
    });

    res.status(201).json(new ApiResponse(201, { collection }, "Collection created successfully"));
  } catch (error) {
    console.error('Create collection error:', error);
    if (error.code === 11000) {
      res.status(400).json(new ApiResponse(400, null, "A collection with this name already exists"));
    } else {
      res.status(error.statusCode || 500).json(new ApiResponse(error.statusCode || 500, null, error.message));
    }
  }
});

// Get all collections
export const getAllCollections = asyncHandler(async (req, res) => {
  try {
    const collections = await Collection.find().sort({ priority: -1, createdAt: -1 });
    res.status(200).json(new ApiResponse(200, { collections }, "Collections retrieved successfully"));
  } catch (error) {
    console.error('Get collections error:', error);
    res.status(500).json(new ApiResponse(500, null, error.message));
  }
});

// Update a collection
export const updateCollection = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const { name, description, priority, isActive } = body;

    const collection = await Collection.findById(id);
    if (!collection) {
      throw new ApiError(404, "Collection not found");
    }

    if (name) collection.name = name;
    if (description !== undefined) collection.description = description;
    if (priority !== undefined) collection.priority = Number(priority);
    if (isActive !== undefined) collection.isActive = isActive === 'true' || isActive === true;

    // Handle Image Update
    if (req.file) {
      if (collection.bannerImage?.public_id) {
        await storageService.deleteFile(collection.bannerImage.public_id);
      }
      
      const uploadResult = await storageService.uploadSingle(req.file, 'collections');
      collection.bannerImage = {
        public_id: uploadResult.public_id,
        url: uploadResult.url
      };
    }

    await collection.save();

    res.status(200).json(new ApiResponse(200, { collection }, "Collection updated successfully"));
  } catch (error) {
    console.error('Update collection error:', error);
    if (error.code === 11000) {
      res.status(400).json(new ApiResponse(400, null, "A collection with this name already exists"));
    } else {
      res.status(error.statusCode || 500).json(new ApiResponse(error.statusCode || 500, null, error.message));
    }
  }
});

// Delete a collection
export const deleteCollection = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const collection = await Collection.findById(id);

    if (!collection) {
      throw new ApiError(404, "Collection not found");
    }

    if (collection.bannerImage?.public_id) {
      await storageService.deleteFile(collection.bannerImage.public_id);
    }

    await Collection.findByIdAndDelete(id);

    res.status(200).json(new ApiResponse(200, null, "Collection deleted successfully"));
  } catch (error) {
    console.error('Delete collection error:', error);
    res.status(500).json(new ApiResponse(500, null, error.message));
  }
});
