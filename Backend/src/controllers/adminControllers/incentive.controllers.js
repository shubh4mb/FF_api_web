/**
 * incentive.controllers.js
 *
 * Admin CRUD for Rider Incentive configurations.
 */

import RiderIncentive from "../../models/riderIncentive.model.js";

/**
 * POST /api/admin/incentives
 * Create a new rider incentive program.
 */
export const createIncentive = async (req, res) => {
    try {
        const { name, description, type, slabs, conditions, effectiveFrom, effectiveTo } = req.body;

        if (!name || !type || !slabs || slabs.length === 0) {
            return res.status(400).json({ message: "name, type, and at least one slab are required." });
        }

        if (!["daily", "weekly"].includes(type)) {
            return res.status(400).json({ message: "type must be 'daily' or 'weekly'." });
        }

        // Validate slabs
        for (const slab of slabs) {
            if (!slab.minOrders || !slab.bonus || slab.minOrders < 1 || slab.bonus < 1) {
                return res.status(400).json({ message: "Each slab must have minOrders >= 1 and bonus >= 1." });
            }
        }

        const incentive = new RiderIncentive({
            name,
            description,
            type,
            slabs,
            conditions: conditions || {},
            effectiveFrom: effectiveFrom || new Date(),
            effectiveTo: effectiveTo || null,
        });

        await incentive.save();

        return res.status(201).json({
            success: true,
            message: "Incentive created successfully.",
            incentive,
        });
    } catch (error) {
        console.error("Create incentive error:", error);
        return res.status(500).json({ message: "Failed to create incentive." });
    }
};

/**
 * GET /api/admin/incentives
 * List all incentive programs.
 */
export const getAllIncentives = async (req, res) => {
    try {
        const incentives = await RiderIncentive.find()
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({ success: true, incentives });
    } catch (error) {
        console.error("Get incentives error:", error);
        return res.status(500).json({ message: "Failed to fetch incentives." });
    }
};

/**
 * PUT /api/admin/incentives/:id
 * Update an incentive (name, slabs, conditions, etc.)
 */
export const updateIncentive = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // If slabs are being updated, validate
        if (updates.slabs) {
            for (const slab of updates.slabs) {
                if (!slab.minOrders || !slab.bonus || slab.minOrders < 1 || slab.bonus < 1) {
                    return res.status(400).json({ message: "Each slab must have minOrders >= 1 and bonus >= 1." });
                }
            }
        }

        const incentive = await RiderIncentive.findByIdAndUpdate(id, updates, { new: true, runValidators: true });

        if (!incentive) {
            return res.status(404).json({ message: "Incentive not found." });
        }

        return res.status(200).json({ success: true, message: "Incentive updated.", incentive });
    } catch (error) {
        console.error("Update incentive error:", error);
        return res.status(500).json({ message: "Failed to update incentive." });
    }
};

/**
 * PATCH /api/admin/incentives/:id/toggle
 * Activate or deactivate an incentive.
 */
export const toggleIncentive = async (req, res) => {
    try {
        const { id } = req.params;
        const incentive = await RiderIncentive.findById(id);

        if (!incentive) {
            return res.status(404).json({ message: "Incentive not found." });
        }

        incentive.isActive = !incentive.isActive;
        await incentive.save();

        return res.status(200).json({
            success: true,
            message: `Incentive ${incentive.isActive ? "activated" : "deactivated"}.`,
            incentive,
        });
    } catch (error) {
        console.error("Toggle incentive error:", error);
        return res.status(500).json({ message: "Failed to toggle incentive." });
    }
};

/**
 * DELETE /api/admin/incentives/:id
 */
export const deleteIncentive = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await RiderIncentive.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({ message: "Incentive not found." });
        }

        return res.status(200).json({ success: true, message: "Incentive deleted." });
    } catch (error) {
        console.error("Delete incentive error:", error);
        return res.status(500).json({ message: "Failed to delete incentive." });
    }
};
