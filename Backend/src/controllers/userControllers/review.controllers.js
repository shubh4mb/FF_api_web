import Review from "../../models/review.model.js";
import Order from "../../models/order.model.js";
import Product from "../../models/product.model.js";
import Merchant from "../../models/merchant.model.js";
import DeliveryRider from "../../models/deliveryRider.model.js";
import User from "../../models/user.model.js";

// ─── AGGREGATE HELPER ────────────────────────────────────────────
const MODEL_MAP = {
    product: { model: Product, ratingField: "ratings", countField: "numReviews" },
    merchant: { model: Merchant, ratingField: "rating", countField: "reviewCount" },
    rider: { model: DeliveryRider, ratingField: "rating", countField: "reviewCount" },
    customer: { model: User, ratingField: "rating", countField: "reviewCount" },
};

async function syncRating(targetId, targetType) {
    const config = MODEL_MAP[targetType];
    if (!config) return;

    const [result] = await Review.aggregate([
        { $match: { targetId, targetType } },
        { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);

    const avg = result ? Math.round(result.avg * 10) / 10 : 0; // 1 decimal
    const count = result ? result.count : 0;

    await config.model.findByIdAndUpdate(targetId, {
        [config.ratingField]: avg,
        [config.countField]: count,
    });
}

// ─── VALID COMPLETED STATUSES ────────────────────────────────────
const COMPLETED_STATUSES = ["completed", "confirmed_purchase", "delivered", "partially_returned"];

// ─── CREATE / UPDATE REVIEW (Customer) ───────────────────────────
export const createReview = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { targetId, targetType, orderId, rating, title, comment, images } = req.body;

        if (!targetId || !targetType || !orderId || !rating) {
            return res.status(400).json({ message: "targetId, targetType, orderId, and rating are required" });
        }

        if (!["product", "merchant", "rider"].includes(targetType)) {
            return res.status(400).json({ message: "Customers can review: product, merchant, or rider" });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ message: "Rating must be between 1 and 5" });
        }

        // Verify user owns this order and it's completed
        const order = await Order.findOne({
            _id: orderId,
            userId,
            orderStatus: { $in: COMPLETED_STATUSES },
        }).lean();

        if (!order) {
            return res.status(403).json({ message: "You can only review completed orders" });
        }

        // Verify target belongs to this order
        if (targetType === "product") {
            const hasProduct = order.items.some(
                (item) => item.productId.toString() === targetId
            );
            if (!hasProduct) {
                return res.status(403).json({ message: "This product is not in your order" });
            }
        } else if (targetType === "merchant") {
            if (order.merchantId.toString() !== targetId) {
                return res.status(403).json({ message: "This merchant is not in your order" });
            }
        } else if (targetType === "rider") {
            if (!order.deliveryRiderId || order.deliveryRiderId.toString() !== targetId) {
                return res.status(403).json({ message: "This rider did not deliver your order" });
            }
        }

        // Upsert — update if exists, create if not
        const review = await Review.findOneAndUpdate(
            { userId, targetId, targetType, orderId },
            {
                userId,
                reviewerType: "customer",
                targetId,
                targetType,
                orderId,
                rating,
                title: title || null,
                comment: comment || null,
                images: images || [],
            },
            { upsert: true, new: true, runValidators: true }
        );

        // Recalculate aggregate
        await syncRating(review.targetId, targetType);

        return res.status(201).json({ message: "Review submitted", review });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "Review already exists for this order" });
        }
        console.error("createReview error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── CREATE REVIEW (Rider → Customer) ────────────────────────────
export const createRiderReview = async (req, res) => {
    try {
        const riderId = req.riderId;
        const { targetId, orderId, rating, comment } = req.body;

        if (!targetId || !orderId || !rating) {
            return res.status(400).json({ message: "targetId (userId), orderId, and rating are required" });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ message: "Rating must be between 1 and 5" });
        }

        // Verify rider handled this order
        const order = await Order.findOne({
            _id: orderId,
            deliveryRiderId: riderId,
            orderStatus: { $in: COMPLETED_STATUSES },
        }).lean();

        if (!order) {
            return res.status(403).json({ message: "You can only review customers from your completed deliveries" });
        }

        // Verify target is the actual customer
        if (order.userId.toString() !== targetId) {
            return res.status(403).json({ message: "This user is not the customer of this order" });
        }

        const review = await Review.findOneAndUpdate(
            { userId: riderId, targetId, targetType: "customer", orderId },
            {
                userId: riderId,
                reviewerType: "rider",
                targetId,
                targetType: "customer",
                orderId,
                rating,
                comment: comment || null,
            },
            { upsert: true, new: true, runValidators: true }
        );

        await syncRating(review.targetId, "customer");

        return res.status(201).json({ message: "Customer review submitted", review });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "Review already exists" });
        }
        console.error("createRiderReview error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── GET REVIEWS FOR A TARGET (Public) ───────────────────────────
export const getReviews = async (req, res) => {
    try {
        const { targetType, targetId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        if (!["product", "merchant", "rider", "customer"].includes(targetType)) {
            return res.status(400).json({ message: "Invalid target type" });
        }

        const [reviews, total] = await Promise.all([
            Review.find({ targetId, targetType })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("userId", "name")
                .lean(),
            Review.countDocuments({ targetId, targetType }),
        ]);

        return res.status(200).json({
            reviews,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("getReviews error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── GET MY REVIEWS (Customer) ───────────────────────────────────
export const getMyReviews = async (req, res) => {
    try {
        const userId = req.user.userId;

        const reviews = await Review.find({ userId, reviewerType: "customer" })
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({ reviews });
    } catch (error) {
        console.error("getMyReviews error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── DELETE REVIEW ───────────────────────────────────────────────
export const deleteReview = async (req, res) => {
    try {
        const userId = req.user?.userId || req.riderId;
        const { reviewId } = req.params;

        const review = await Review.findOne({ _id: reviewId, userId });
        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }

        const { targetId, targetType } = review;
        await review.deleteOne();

        // Recalculate aggregate
        await syncRating(targetId, targetType);

        return res.status(200).json({ message: "Review deleted" });
    } catch (error) {
        console.error("deleteReview error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── GET REVIEWABLE ITEMS (Customer) ─────────────────────────────
// Returns products, merchants, and riders the user can review
export const getReviewableItems = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get completed orders
        const orders = await Order.find({
            userId,
            orderStatus: { $in: COMPLETED_STATUSES },
        })
            .select("_id merchantId deliveryRiderId items")
            .lean();

        if (!orders.length) {
            return res.status(200).json({ reviewable: [] });
        }

        // Get existing reviews by this user
        const existingReviews = await Review.find({
            userId,
            reviewerType: "customer",
        })
            .select("targetId targetType orderId")
            .lean();

        const reviewedSet = new Set(
            existingReviews.map((r) => `${r.orderId}_${r.targetType}_${r.targetId}`)
        );

        const reviewable = [];

        for (const order of orders) {
            const orderId = order._id.toString();

            // Products
            for (const item of order.items) {
                const key = `${orderId}_product_${item.productId}`;
                if (!reviewedSet.has(key)) {
                    reviewable.push({
                        orderId,
                        targetId: item.productId,
                        targetType: "product",
                        name: item.name,
                        image: item.image,
                    });
                }
            }

            // Merchant
            if (order.merchantId) {
                const key = `${orderId}_merchant_${order.merchantId}`;
                if (!reviewedSet.has(key)) {
                    reviewable.push({
                        orderId,
                        targetId: order.merchantId,
                        targetType: "merchant",
                    });
                }
            }

            // Rider
            if (order.deliveryRiderId) {
                const key = `${orderId}_rider_${order.deliveryRiderId}`;
                if (!reviewedSet.has(key)) {
                    reviewable.push({
                        orderId,
                        targetId: order.deliveryRiderId,
                        targetType: "rider",
                    });
                }
            }
        }

        return res.status(200).json({ reviewable });
    } catch (error) {
        console.error("getReviewableItems error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─── GET MERCHANT'S OWN REVIEWS (Merchant Dashboard) ─────────────
export const getMerchantOwnReviews = async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const [reviews, total] = await Promise.all([
            Review.find({ targetId: merchantId, targetType: "merchant" })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("userId", "name")
                .lean(),
            Review.countDocuments({ targetId: merchantId, targetType: "merchant" }),
        ]);

        return res.status(200).json({
            reviews,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error("getMerchantOwnReviews error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
