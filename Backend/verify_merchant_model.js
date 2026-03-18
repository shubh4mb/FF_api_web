import mongoose from 'mongoose';
import Merchant from './src/models/merchant.model.js';
import dotenv from 'dotenv';

dotenv.config();

async function testGenderCategory() {
  try {
    // 1. Check if we can connect to DB
    if (!process.env.MONGODB_URI) {
        console.log("MONGODB_URI not found in .env, skipping live DB test.");
        return;
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    // 2. Create a test merchant with multiple gender categories
    const testMerchant = new Merchant({
      email: `test_merchant_${Date.now()}@example.com`,
      shopName: "Test Shop",
      genderCategory: ["Men", "Kids"]
    });

    await testMerchant.save();
    console.log("Saved merchant with array genderCategory:", testMerchant.genderCategory);

    // 3. Update with a single value (should become an array of one)
    testMerchant.genderCategory = ["Women"];
    await testMerchant.save();
    console.log("Updated merchant with single value array:", testMerchant.genderCategory);

    // 4. Try invalid value (should fail)
    try {
        testMerchant.genderCategory = ["Invalid"];
        await testMerchant.save();
        console.log("ERROR: Invalid value was accepted!");
    } catch (err) {
        console.log("Validation correctly failed for invalid value:", err.message);
    }

    // Cleanup
    await Merchant.deleteOne({ _id: testMerchant._id });
    console.log("Cleaned up test merchant.");

    await mongoose.disconnect();
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

testGenderCategory();
