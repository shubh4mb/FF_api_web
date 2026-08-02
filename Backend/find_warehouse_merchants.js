import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Merchant from './src/models/merchant.model.js';
import Product from './src/models/product.model.js';

dotenv.config();

const findWarehouseMerchants = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        const warehouseProducts = await Product.find({ source: 'warehouse' }).lean();
        const merchantIds = [...new Set(warehouseProducts.map(p => p.merchantId.toString()))];

        const merchants = await Merchant.find({ _id: { $in: merchantIds } }).select('shopName').lean();
        console.log(`Found ${merchants.length} merchants with warehouse products:`);
        merchants.forEach(m => console.log(`- ${m.shopName}`));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

findWarehouseMerchants();
