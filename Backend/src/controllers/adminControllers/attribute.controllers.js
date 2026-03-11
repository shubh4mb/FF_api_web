import Attribute from '../../models/attribute.model.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

// Create a new attribute
export const createAttribute = asyncHandler(async (req, res) => {
    try {
        const { name, categoryId, inputType, isFilterable, isRequired, values } = req.body;

        if (!name || !categoryId || !inputType) {
            throw new ApiError(400, 'name, categoryId, and inputType are required');
        }

        // Validate values for select/multiselect
        if (['select', 'multiselect'].includes(inputType)) {
            if (!values || !Array.isArray(values) || values.length === 0) {
                throw new ApiError(400, 'At least one option is required for select/multiselect types');
            }
        }

        const attribute = new Attribute({
            name,
            categoryId,
            inputType,
            isFilterable: isFilterable || false,
            isRequired: isRequired || false,
            values: ['select', 'multiselect'].includes(inputType) ? values : undefined
        });

        await attribute.save();
        const populated = await Attribute.findById(attribute._id).populate('categoryId', 'name level');
        res.status(201).json(new ApiResponse(201, { attribute: populated }, 'Attribute created successfully'));
    } catch (error) {
        if (error.code === 11000) {
            res.status(400).json(new ApiResponse(400, null, 'An attribute with this slug already exists'));
        } else {
            console.error('Create attribute error:', error);
            res.status(400).json(new ApiResponse(400, null, error.message));
        }
    }
});

// Get all attributes (optionally filter by categoryId)
export const getAttributes = asyncHandler(async (req, res) => {
    try {
        const { categoryId } = req.query;
        const filter = categoryId ? { categoryId } : {};

        const attributes = await Attribute.find(filter)
            .populate('categoryId', 'name level')
            .sort({ createdAt: -1 });

        res.status(200).json(new ApiResponse(200, { attributes, count: attributes.length }, 'Attributes retrieved successfully'));
    } catch (error) {
        console.error('Get attributes error:', error);
        res.status(500).json(new ApiResponse(500, null, error.message));
    }
});

// Update an attribute
export const updateAttribute = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { name, categoryId, inputType, isFilterable, isRequired, values } = req.body;

        const attribute = await Attribute.findById(id);
        if (!attribute) {
            throw new ApiError(404, 'Attribute not found');
        }

        // Validate values for select/multiselect
        const effectiveInputType = inputType || attribute.inputType;
        if (['select', 'multiselect'].includes(effectiveInputType)) {
            if (!values || !Array.isArray(values) || values.length === 0) {
                throw new ApiError(400, 'At least one option is required for select/multiselect types');
            }
        }

        if (name) attribute.name = name;
        if (categoryId) attribute.categoryId = categoryId;
        if (inputType) attribute.inputType = inputType;
        if (typeof isFilterable === 'boolean') attribute.isFilterable = isFilterable;
        if (typeof isRequired === 'boolean') attribute.isRequired = isRequired;

        // Handle values
        if (['select', 'multiselect'].includes(effectiveInputType)) {
            attribute.values = values;
        } else {
            attribute.values = undefined;
        }

        // Regenerate slug if name changed
        if (name && name !== attribute.name) {
            attribute.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        }

        await attribute.save();
        const populated = await Attribute.findById(attribute._id).populate('categoryId', 'name level');
        res.status(200).json(new ApiResponse(200, { attribute: populated }, 'Attribute updated successfully'));
    } catch (error) {
        if (error.code === 11000) {
            res.status(400).json(new ApiResponse(400, null, 'An attribute with this slug already exists'));
        } else {
            console.error('Update attribute error:', error);
            res.status(400).json(new ApiResponse(400, null, error.message));
        }
    }
});

// Delete an attribute
export const deleteAttribute = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const attribute = await Attribute.findByIdAndDelete(id);

        if (!attribute) {
            throw new ApiError(404, 'Attribute not found');
        }

        res.status(200).json(new ApiResponse(200, null, 'Attribute deleted successfully'));
    } catch (error) {
        console.error('Delete attribute error:', error);
        res.status(500).json(new ApiResponse(500, null, error.message));
    }
});
