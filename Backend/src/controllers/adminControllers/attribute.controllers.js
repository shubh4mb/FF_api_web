import Attribute from '../../models/attribute.model.js';
import Category from '../../models/category.model.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

// Create a new attribute
export const createAttribute = asyncHandler(async (req, res) => {
    try {
        const { name, categoryId, categoryIds, inputType, isFilterable, isRequired, values } = req.body;

        if (!name || !inputType) {
            throw new ApiError(400, 'name and inputType are required');
        }

        // Validate values for select/multiselect
        if (['select', 'multiselect'].includes(inputType)) {
            if (!values || !Array.isArray(values) || values.length === 0) {
                throw new ApiError(400, 'At least one option is required for select/multiselect types');
            }
        }

        const attribute = new Attribute({
            name,
            inputType,
            values: ['select', 'multiselect'].includes(inputType) ? values : undefined
        });

        await attribute.save();
        
        let targetCategories = [];
        if (categoryIds && Array.isArray(categoryIds)) {
            targetCategories = categoryIds;
        } else if (categoryId) {
            targetCategories = [categoryId]; // Fallback for backward compatibility
        }

        if (targetCategories.length > 0) {
            await Category.updateMany(
                { _id: { $in: targetCategories } },
                { 
                    $push: { 
                        attributes: {
                            attribute: attribute._id,
                            isRequired: isRequired || false,
                            isFilterable: isFilterable || false,
                            order: 0
                        }
                    } 
                }
            );
        }
        
        res.status(201).json(new ApiResponse(201, { attribute }, 'Attribute created successfully'));
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
        let filter = {};
        
        if (categoryId) {
            const category = await Category.findById(categoryId);
            if (!category) {
                throw new ApiError(404, 'Category not found');
            }
            const attributeIds = category.attributes.map(attr => attr.attribute);
            filter = { _id: { $in: attributeIds } };
        }

        const attributes = await Attribute.find(filter)
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
        const { name, inputType, values, categoryIds, isRequired, isFilterable } = req.body;

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
        if (inputType) attribute.inputType = inputType;

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

        // Handle category syncing if categoryIds is provided
        if (categoryIds && Array.isArray(categoryIds)) {
            const currentLinkedCategories = await Category.find({ 'attributes.attribute': id }, '_id');
            const currentCategoryIds = currentLinkedCategories.map(c => c._id.toString());
            const newCategoryIds = categoryIds.map(catId => catId.toString());

            const addedCategoryIds = newCategoryIds.filter(catId => !currentCategoryIds.includes(catId));
            const removedCategoryIds = currentCategoryIds.filter(catId => !newCategoryIds.includes(catId));
            const keptCategoryIds = currentCategoryIds.filter(catId => newCategoryIds.includes(catId));

            // Pull from removed
            if (removedCategoryIds.length > 0) {
                await Category.updateMany(
                    { _id: { $in: removedCategoryIds } },
                    { $pull: { attributes: { attribute: id } } }
                );
            }

            // Push to added
            if (addedCategoryIds.length > 0) {
                await Category.updateMany(
                    { _id: { $in: addedCategoryIds } },
                    { 
                        $push: { 
                            attributes: {
                                attribute: id,
                                isRequired: isRequired || false,
                                isFilterable: isFilterable || false,
                                order: 0
                            }
                        } 
                    }
                );
            }

            // Update flags for kept categories
            if (keptCategoryIds.length > 0 && (isRequired !== undefined || isFilterable !== undefined)) {
                await Category.updateMany(
                    { _id: { $in: keptCategoryIds }, 'attributes.attribute': id },
                    { 
                        $set: { 
                            'attributes.$.isRequired': isRequired || false,
                            'attributes.$.isFilterable': isFilterable || false
                        } 
                    }
                );
            }
        }
        res.status(200).json(new ApiResponse(200, { attribute }, 'Attribute updated successfully'));
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
