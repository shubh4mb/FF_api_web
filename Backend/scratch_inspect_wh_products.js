import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function inspectWarehouseLegacyProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const rawProducts = await db.collection('products').find({
      $or: [
        { source: 'warehouse' },
        { warehouseId: { $exists: true, $ne: null } }
      ]
    }).toArray();

    console.log(JSON.stringify(rawProducts, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

inspectWarehouseLegacyProducts();
