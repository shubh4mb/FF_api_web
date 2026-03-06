import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import Admin from '../models/admin.model.js';

export const verifyAdmin = asyncHandler(async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            throw new ApiError(401, "Unauthorized request");
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

        // Uses adminId defined in token payload
        const admin = await Admin.findById(decodedToken.adminId).select("-password");

        if (!admin) {
            throw new ApiError(401, "Invalid Access Token or Admin not found");
        }

        req.admin = admin; // Injecting explicitly as req.admin
        next();
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token");
    }
});
