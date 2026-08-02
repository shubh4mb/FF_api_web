import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Merchant from './src/models/merchant.model.js';
import Product from './src/models/product.model.js';

dotenv.config();

const checkSuki = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        // 1. Find Suki
        const suki = await Merchant.findOne({ shopName: { $regex: /suki/i } }).lean();
        if (!suki) {
            console.log("Merchant 'Suki' not found in database.");
            process.exit(0);
        }

        console.log(`Found Merchant: ${suki.shopName} (ID: ${suki._id})`);
        console.log(`Warehouse Status: ${suki.warehouseStatus}`);
        console.log(`Assigned Warehouse IDs: ${suki.assignedWarehouseIds}`);

        // 2. Check Products
        const warehouseProducts = await Product.find({ 
            merchantId: suki._id, 
            source: 'warehouse' 
        }).populate('warehouseId', 'name').lean();

        console.log(`\nFound ${warehouseProducts.length} warehouse products for ${suki.shopName}:`);
        warehouseProducts.forEach(p => {
            console.log(`- ${p.name} (Warehouse: ${p.warehouseId?.name || 'None'})`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkSuki();
