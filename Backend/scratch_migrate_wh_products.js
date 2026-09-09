import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import ProductFlat from './src/models/productFlat.model.js';

async function migrateWarehouseProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const legacyProducts = await db.collection('products').find({
      $or: [
        { source: 'warehouse' },
        { warehouseId: { $exists: true, $ne: null } }
      ]
    }).toArray();

    console.log(`Found ${legacyProducts.length} legacy warehouse products to migrate.`);

    for (const prod of legacyProducts) {
      const styleGroupId = prod._id.toString();
      
      // Check if already in ProductFlat
      const existing = await ProductFlat.findOne({ styleGroupId });
      if (existing) {
        console.log(`Product "${prod.name}" (${styleGroupId}) already exists in ProductFlat. Skipping.`);
        continue;
      }

      let insertedCount = 0;
      for (const variant of prod.variants || []) {
        const color = variant.color;
        const mrp = variant.mrp;
        const price = variant.price;
        const discount = variant.discount || 0;
        const images = variant.images || [];

        for (const sizeObj of variant.sizes || []) {
          const flatDoc = {
            name: prod.name,
            productCode: `${prod.productCode}-${color?.name || 'DEF'}-${sizeObj.size}`,
            styleGroupId,
            source: prod.source || 'warehouse',
            warehouseId: prod.warehouseId ? new mongoose.Types.ObjectId(prod.warehouseId) : null,
            commissionRate: prod.commissionRate || null,
            addedByOperator: prod.addedByOperator ? new mongoose.Types.ObjectId(prod.addedByOperator) : null,
            merchantId: new mongoose.Types.ObjectId(prod.merchantId),
            brandId: prod.brandId ? new mongoose.Types.ObjectId(prod.brandId) : null,
            categoryId: new mongoose.Types.ObjectId(prod.categoryId),
            subCategoryId: prod.subCategoryId ? new mongoose.Types.ObjectId(prod.subCategoryId) : null,
            subSubCategoryId: prod.subSubCategoryId ? new mongoose.Types.ObjectId(prod.subSubCategoryId) : null,
            gender: prod.gender || ['MEN'],
            color: color || { name: 'Default', hex: '#000000' },
            size: sizeObj.size,
            stock: sizeObj.stock || 0,
            reservedStock: sizeObj.reservedStock || 0,
            price,
            mrp,
            discount,
            images,
            description: prod.description || '',
            styleName: prod.styleName || '',
            features: prod.features || {},
            attributes: prod.attributes || [],
            tags: prod.tags || [],
            collectionIds: (prod.collectionIds || []).map(id => new mongoose.Types.ObjectId(id)),
            isTriable: prod.isTriable !== false,
            ratings: prod.ratings || 0,
            numReviews: prod.numReviews || 0,
            isActive: prod.isActive !== false,
            isVerified: prod.isVerified !== false,
            isDeleted: false,
            createdAt: prod.createdAt || new Date(),
            updatedAt: prod.updatedAt || new Date()
          };

          await ProductFlat.create(flatDoc);
          insertedCount++;
        }
      }

      console.log(`Successfully migrated "${prod.name}" into ${insertedCount} flat SKU variants.`);
    }

  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

migrateWarehouseProducts();
