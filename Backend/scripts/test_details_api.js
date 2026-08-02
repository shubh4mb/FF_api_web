// Register all mongoose models first to prevent "Schema hasn't been registered" errors
import '../src/models/brand.model.js';
import '../src/models/category.model.js';
import '../src/models/merchant.model.js';
import '../src/models/attribute.model.js';
import '../src/models/collection.model.js';
import '../src/models/product.model.js';
import '../src/models/productFlat.model.js';

import { productsDetails } from '../src/controllers/userControllers/product.controllers.js';
import connectDB from '../src/config/db.js';
import mongoose from 'mongoose';
import assert from 'assert';

// Force feature flag to true
process.env.USE_FLAT_PRODUCT_SCHEMA = 'true';

console.log('🧪 Starting details API endpoint adapter verification inside Backend context...');

const run = async () => {
  await connectDB();

  try {
    // We will test with the Style Group ID populated in Phase 2
    const targetStyleGroupId = '6a52ce12f5d225d81a328521'; // Oversized Cotton Shirt

    // Mock Express request
    const req = {
      params: { id: targetStyleGroupId },
      nearbyMerchantIds: ['6a52c077f5d225d81a327965'] // match the merchantId from the DB
    };

    let responseStatus = null;
    let responseJson = null;

    // Mock Express response
    const res = {
      status: (code) => {
        responseStatus = code;
        return res;
      },
      json: (data) => {
        responseJson = data;
        return res;
      }
    };

    // Execute the controller function directly
    await productsDetails(req, res);

    console.log(`📡 Response Status: ${responseStatus}`);
    
    if (responseStatus !== 200) {
      throw new Error(`API returned error status ${responseStatus}: ${JSON.stringify(responseJson)}`);
    }

    assert.ok(responseJson, 'Should return a valid response JSON object');
    assert.strictEqual(responseJson._id, targetStyleGroupId, 'Returned product _id must match the style group ID');
    assert.strictEqual(responseJson.name, 'Oversized Cotton Shirt', 'Product name should match');
    assert.ok(Array.isArray(responseJson.variants), 'Should contain a variants array');
    
    console.log(`📦 Reconstructed Variants found: ${responseJson.variants.length}`);
    responseJson.variants.forEach((v, index) => {
      console.log(`   Color [${index + 1}]: ${v.color.name} (ID: ${v._id})`);
      console.log(`   Sizes: ${v.sizes.map(s => `${s.size} (stock: ${s.stock})`).join(', ')}`);
      
      assert.ok(v._id, 'Color variant must have an _id');
      assert.ok(v.sizes.length > 0, 'Color variant must contain sizes list');
    });

    console.log('\n🎉 API INTEGRATION VERIFICATION PASSED! Controller correctly queries flat database and formats legacy JSON.');
  } catch (error) {
    console.error('\n❌ Verification failed:');
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed.');
  }
};

run();
