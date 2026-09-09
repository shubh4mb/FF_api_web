import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import ProductFlat from './src/models/productFlat.model.js';

async function checkFlat() {
  await mongoose.connect(process.env.MONGODB_URI);
  const p1 = await ProductFlat.find({ styleGroupId: '6a5f1e7400916329dd05eac2' }).lean();
  const p2 = await ProductFlat.find({ styleGroupId: '6a5f5f2576055ea046fd72c3' }).lean();

  console.log('--- Oversized Cotton Tshirt in ProductFlat ---');
  console.log(JSON.stringify(p1, null, 2));

  console.log('\n--- Test Cotton Blend Tshirt in ProductFlat ---');
  console.log(JSON.stringify(p2, null, 2));

  await mongoose.disconnect();
}

checkFlat();
