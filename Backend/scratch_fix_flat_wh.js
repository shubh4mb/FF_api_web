import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import ProductFlat from './src/models/productFlat.model.js';

async function fixFlatWarehouseFields() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const warehouseId = new mongoose.Types.ObjectId('6a5e4d630906bf3164ab4db5');
    
    const res1 = await ProductFlat.updateMany(
      { styleGroupId: '6a5f1e7400916329dd05eac2' },
      { $set: { source: 'warehouse', warehouseId } }
    );
    console.log('Updated Oversized Cotton Tshirt:', res1);

    const res2 = await ProductFlat.updateMany(
      { styleGroupId: '6a5f5f2576055ea046fd72c3' },
      { $set: { source: 'warehouse', warehouseId } }
    );
    console.log('Updated Test Cotton Blend Tshirt:', res2);

  } catch (err) {
    console.error('Error updating:', err);
  } finally {
    await mongoose.disconnect();
  }
}

fixFlatWarehouseFields();
