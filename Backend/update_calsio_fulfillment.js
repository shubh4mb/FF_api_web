import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Merchant from './src/models/merchant.model.js';
import ProductFlat from './src/models/productFlat.model.js';

dotenv.config();

const updateCalsioFulfillment = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    // Find Calsioclub
    const calsio = await Merchant.findOne({ 
      shopName: { $regex: /calsio/i } 
    });

    if (!calsio) {
      console.log('No merchant found matching "calsio". Listing all merchants:');
      const all = await Merchant.find({}).select('shopName fulfillmentType isVerified isActive').lean();
      console.log(all);
      process.exit(0);
    }

    console.log('Found merchant:', {
      _id: calsio._id,
      shopName: calsio.shopName,
      currentFulfillmentType: calsio.fulfillmentType,
      isVerified: calsio.isVerified,
      isActive: calsio.isActive
    });

    // Update fulfillmentType to 'warehouse'
    calsio.fulfillmentType = 'warehouse';
    await calsio.save();
    console.log(`✅ Successfully updated "${calsio.shopName}" fulfillmentType to "warehouse".`);

    // Check products under this merchant
    const productsCount = await ProductFlat.countDocuments({ merchantId: calsio._id });
    const warehouseProductsCount = await ProductFlat.countDocuments({ 
      merchantId: calsio._id, 
      $or: [{ source: 'warehouse' }, { warehouseId: { $exists: true, $ne: null } }] 
    });

    console.log(`Product Summary for ${calsio.shopName}:`);
    console.log(`- Total SKU variants in ProductFlat: ${productsCount}`);
    console.log(`- Warehouse-linked variants: ${warehouseProductsCount}`);

    process.exit(0);
  } catch (err) {
    console.error('Error in updateCalsioFulfillment:', err);
    process.exit(1);
  }
};

updateCalsioFulfillment();
