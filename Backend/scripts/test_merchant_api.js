// Register all mongoose models first to prevent Mongoose schema errors
import '../src/models/brand.model.js';
import '../src/models/category.model.js';
import '../src/models/merchant.model.js';
import '../src/models/attribute.model.js';
import '../src/models/collection.model.js';
import '../src/models/product.model.js';
import '../src/models/productFlat.model.js';

import { addBaseProduct, addVariant, updateVariantSizeStock, deleteProduct } from '../src/controllers/merchantController/product.controllers.js';
import ProductFlat from '../src/models/productFlat.model.js';
import connectDB from '../src/config/db.js';
import mongoose from 'mongoose';
import assert from 'assert';

// Force feature flag to true
process.env.USE_FLAT_PRODUCT_SCHEMA = 'true';

console.log('🧪 Starting Merchant API Write Endpoints verification...');

const run = async () => {
  await connectDB();

  let testGroupId = null;
  let testVariantId = null;
  const merchantId = '6a52c077f5d225d81a327965'; // mock merchant ID

  try {
    // ----------------------------------------------------
    // TEST 1: addBaseProduct
    // ----------------------------------------------------
    console.log('\n1️⃣ Testing addBaseProduct...');
    const req1 = {
      body: {
        name: 'Test Flat Shirt',
        description: 'Testing product variant migration merchant creation',
        gender: ['MEN'],
        categoryId: '6a52c710f5d225d81a3282b0', // Casual category from DB
        styleName: 'Casual Fit',
        isTriable: true,
        isActive: true,
        attributes: [],
        merchantId: merchantId
      },
      merchantId
    };

    let status1 = null, json1 = null;
    const res1 = {
      status: (code) => { status1 = code; return res1; },
      json: (data) => { json1 = data; return res1; }
    };

    await addBaseProduct(req1, res1);
    console.log(`   Response Status: ${status1}`);
    assert.strictEqual(status1, 201, 'Should successfully create product');
    assert.ok(json1.product, 'Response must contain product data');
    
    testGroupId = json1.product._id;
    console.log(`   Created Style Group ID: ${testGroupId}`);

    // Verify in DB that the dummy variant was created
    const dummyDocs = await ProductFlat.find({ styleGroupId: testGroupId });
    assert.strictEqual(dummyDocs.length, 1, 'Should have exactly 1 dummy variant document');
    assert.strictEqual(dummyDocs[0].size, 'Free', 'Size should be Free');
    assert.strictEqual(dummyDocs[0].color.name, 'Default', 'Color name should be Default');
    assert.strictEqual(dummyDocs[0].stock, 0, 'Stock of dummy should be 0');
    console.log('   ✅ Dummy DEFAULT-FREE variant verified in database.');

    // ----------------------------------------------------
    // TEST 2: addVariant
    // ----------------------------------------------------
    console.log('\n2️⃣ Testing addVariant...');
    const req2 = {
      params: { productId: testGroupId },
      body: {
        color: JSON.stringify({ name: 'Midnight Black', hex: '#000000' }),
        sizes: JSON.stringify([{ size: 'M', stock: 15 }, { size: 'L', stock: 25 }]),
        mrp: 1200,
        price: 999,
        discount: 201,
        images: JSON.stringify([])
      },
      merchantId
    };

    let status2 = null, json2 = null;
    const res2 = {
      status: (code) => { status2 = code; return res2; },
      json: (data) => { json2 = data; return res2; }
    };

    await addVariant(req2, res2);
    assert.ok(json2, 'Should receive JSON response');
    
    // Retrieve new flat documents and verify the dummy was deleted
    const flatDocsAfterVariant = await ProductFlat.find({ styleGroupId: testGroupId });
    console.log(`   Flat SKU documents in DB: ${flatDocsAfterVariant.length}`);
    assert.strictEqual(flatDocsAfterVariant.length, 2, 'Should now have exactly 2 flat variants (M & L)');
    
    // Verify that none are the dummy variant
    const hasDummy = flatDocsAfterVariant.some(v => v.size === 'Free' && v.color.name === 'Default');
    assert.ok(!hasDummy, 'Dummy variant should have been deleted');
    console.log('   ✅ Dummy variant cleanup verified. Real variant SKUs added successfully.');

    testVariantId = json2.variant._id; // Midnight Black color variant ID
    console.log(`   Midnight Black Color Variant ID: ${testVariantId}`);

    // ----------------------------------------------------
    // TEST 3: updateVariantSizeStock
    // ----------------------------------------------------
    console.log('\n3️⃣ Testing updateVariantSizeStock (Size: M)...');
    const req3 = {
      params: { productId: testGroupId, variantId: testVariantId, sizeName: 'M' },
      body: { stock: 88 },
      merchantId
    };

    let status3 = null, json3 = null;
    const res3 = {
      status: (code) => { status3 = code; return res3; },
      json: (data) => { json3 = data; return res3; }
    };

    await updateVariantSizeStock(req3, res3);
    console.log(`   Response Status: ${status3}`);
    assert.strictEqual(status3, 200, 'Should return success 200');

    // Verify stock update in DB
    const mDoc = await ProductFlat.findOne({ styleGroupId: testGroupId, size: 'M' });
    assert.strictEqual(mDoc.stock, 88, 'Stock for M size must be updated to 88');
    console.log('   ✅ Stock update verified in database.');

    // ----------------------------------------------------
    // TEST 4: deleteProduct
    // ----------------------------------------------------
    console.log('\n4️⃣ Testing deleteProduct...');
    const req4 = {
      params: { productId: testGroupId },
      merchantId
    };

    let status4 = null, json4 = null;
    const res4 = {
      status: (code) => { status4 = code; return res4; },
      json: (data) => { json4 = data; return res4; }
    };

    await deleteProduct(req4, res4);
    
    // Verify all docs of styleGroupId are marked as isDeleted: true
    const docsAfterDelete = await ProductFlat.find({ styleGroupId: testGroupId });
    docsAfterDelete.forEach(d => {
      assert.strictEqual(d.isDeleted, true, `Document ${d._id} must be marked deleted`);
    });
    console.log('   ✅ Soft deletion of style group verified in database.');

    // Cleanup: physically delete these test documents so we don't dirty the preproduction DB
    await ProductFlat.deleteMany({ styleGroupId: testGroupId });
    console.log('   🧹 Test documents cleaned up.');

    console.log('\n🎉 ALL MERCHANT WRITE PATH VERIFICATIONS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ Verification failed:');
    console.error(error);
    // Cleanup on failure
    if (testGroupId) {
      await ProductFlat.deleteMany({ styleGroupId: testGroupId });
    }
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed.');
  }
};

run();
