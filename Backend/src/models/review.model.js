import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            // Can be a User or DeliveryRider — the reviewerType clarifies
        },
        reviewerType: {
            type: String,
            enum: ["customer", "rider"],
            required: true,
        },
        targetId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        targetType: {
            type: String,
            enum: ["product", "merchant", "rider", "customer"],
            required: true,
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        title: {
            type: String,
            maxlength: 100,
            default: null,
        },
        comment: {
            type: String,
            maxlength: 500,
            default: null,
        },
        images: {
            type: [String],
            validate: [arr => arr.length <= 3, "Maximum 3 images allowed"],
            default: [],
        },
    },
    { timestamps: true }
);

// One review per reviewer per target per order
reviewSchema.index({ userId: 1, targetId: 1, targetType: 1, orderId: 1 }, { unique: true });

// Fast lookups: all reviews for a product/merchant/rider/customer
reviewSchema.index({ targetId: 1, targetType: 1, createdAt: -1 });

// Fast lookups: all reviews by a user
reviewSchema.index({ userId: 1, reviewerType: 1, createdAt: -1 });

export default mongoose.model("Review", reviewSchema);
