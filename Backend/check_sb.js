import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Merchant from './src/models/merchant.model.js';
import Product from './src/models/product.model.js';

dotenv.config();

const checkSB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        const sb = await Merchant.findOne({ shopName: /SB Fashion/i }).lean();
        if (!sb) {
            console.log("No SB Fashion");
            process.exit(0);
        }
        
        const products = await Product.find({ merchantId: sb._id, source: 'warehouse' }).lean();
        console.log(`Found ${products.length} total warehouse products for SB Fashion.`);
        
        const activeProducts = products.filter(p => p.isActive !== false && p.isDeleted !== true && p.variants && p.variants.length > 0);
        console.log(`Found ${activeProducts.length} ACTIVE warehouse products for SB Fashion.`);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkSB();
