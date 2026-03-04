import Brand from "../../models/brand.model.js";
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

export const addBrand = asyncHandler(async (req, res) => {
    console.log(req.body);
    const { name, description, logo, createdById, createdByType } = req.body;
    const brand = await Brand.create({ name, description, logo, createdById, createdByType });
    return res.status(201).json(new ApiResponse(201, { brand }, "Brand created successfully"));
});

export const getBrands = asyncHandler(async (req, res) => {
    const brands = await Brand.find({});
    return res.status(200).json(new ApiResponse(200, { brands }, "Brands retrieved successfully"));
});