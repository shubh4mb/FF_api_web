import jwt from 'jsonwebtoken';
import Admin from '../models/admin.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

// @desc    Admin login
// @route   POST /api/auth/admin/login
// @access  Public
export const adminLogin = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    console.log(email, password);


    if (!email || !password) {
        throw new ApiError(400, "Email and password are required");
    }

    const adminUser = await Admin.findOne({ email });
    console.log(adminUser);

    if (!adminUser) {
        throw new ApiError(401, "Invalid email or password");
    }

    const isPasswordValid = await adminUser.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid emailllll or password");
    }

    const token = jwt.sign(
        { adminId: adminUser._id, role: adminUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '1d' } // 1 day expiration for admin
    );

    adminUser.lastLogin = new Date();
    await adminUser.save({ validateBeforeSave: false }); // Skip validation for just updating last login

    const loggedInAdmin = await Admin.findById(adminUser._id).select('-password');

    return res.status(200).json(
        new ApiResponse(
            200,
            { admin: loggedInAdmin, token },
            "Admin logged in successfully"
        )
    );
});

// @desc    Admin registration
// @route   POST /api/auth/admin/register
// @access  Public (Should remove or secure after first use)
export const registerAdmin = asyncHandler(async (req, res) => {
    console.log(req.body);
    const { email, password, name, phoneNumber } = req.body;

    if (!email || !password) {
        throw new ApiError(400, "Email and password are required for registration");
    }

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
        return res.status(400).json(new ApiResponse(400, null, "Admin with this email already exists."));
    }

    const admin = await Admin.create({
        name: name || "Super Admin",
        email,
        phoneNumber,
        password,
        role: 'superadmin',
    });

    const createdAdmin = await Admin.findById(admin._id).select('-password');

    return res.status(201).json(
        new ApiResponse(201, createdAdmin, "Admin registered successfully")
    );
});
