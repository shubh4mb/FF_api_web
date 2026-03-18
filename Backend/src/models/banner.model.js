import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema({
    title: {
        type: String, // optional internal name
        trim: true,
    },
    imageUrl: {
        type: String, // from cloudinary
        required: true,
    },
    type: {
        type: String,
        enum: [
            'home_hero',          // top of home screen
            'home_middle',        // middle of home screen
            'explore_hero',       // top of explore page
            'category_banner',    // inside specific categories
            'promotional',        // general promo banners
            'new_arrivals_banner', // specialized section banners
            'trending_banner',
            'recommended_banner',
        ],
        required: true,
    },
    ratio: {
        type: String, // e.g., '16:9', '4:3', '1:1', '21:9'
        required: true,
    },
    actionUrl: {
        type: String, // exact deep link or screen to open on click
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    order: {
        type: Number, // for sorting banners of the same type
        default: 0,
    }
}, { timestamps: true });

bannerSchema.index({ type: 1, isActive: 1, order: 1 }); // highly optimized read index

export default mongoose.model("Banner", bannerSchema);
