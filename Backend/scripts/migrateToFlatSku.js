import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Product from '../src/models/product.model.js';
import ProductFlat from '../src/models/productFlat.model.js';
import { convertToFlatFormat } from '../src/utils/variantAdapter.js';

const run = async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const clean = args.includes('--clean');

  console.log(`🚀 Starting Product Sku Flat Migration...`);
  console.log(`   Config: [dry-run: ${dryRun}], [clean: ${clean}]`);

  // Connect to DB
  await connectDB();

  try {
    // 1. Fetch all products from legacy collection
    const legacyProducts = await Product.find({}).lean();
    console.log(`📦 Found ${legacyProducts.length} legacy product documents in collection.`);

    if (legacyProducts.length === 0) {
      console.log('⚠️ No products found to migrate.');
      process.exit(0);
    }

    // 2. Perform flat conversion in memory
    let allFlatProducts = [];
    legacyProducts.forEach(product => {
      const flatVariants = convertToFlatFormat(product);
      allFlatProducts.push(...flatVariants);
    });

    console.log(`✨ Generated ${allFlatProducts.length} flat variant documents.`);

    if (dryRun) {
      console.log('🔍 [DRY-RUN] Sample of generated flat variant document:');
      if (allFlatProducts.length > 0) {
        console.log(JSON.stringify(allFlatProducts[0], null, 2));
      }
      console.log(`\n✅ Dry run completed. No data was written to the database.`);
      process.exit(0);
    }

    // 3. Optional clean step
    if (clean) {
      console.log(`🧹 Clearing existing 'productflats' collection...`);
      const deleteResult = await ProductFlat.deleteMany({});
      console.log(`   Deleted ${deleteResult.deletedCount} old flat products.`);
    }

    // 4. Bulk Insert flat documents to database
    console.log(`💾 Inserting flat products in bulk into MONGODB...`);
    const insertResult = await ProductFlat.insertMany(allFlatProducts);
    console.log(`✅ Success! Successfully migrated and saved ${insertResult.length} flat product documents.`);

  } catch (error) {
    console.error(`❌ Migration failed with error:`);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log(`🔌 Database connection closed.`);
  }
};

run();
