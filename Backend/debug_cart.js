import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set!");
  process.exit(1);
}

const ProductFlatSchema = new mongoose.Schema({}, { strict: false });
const ProductFlat = mongoose.models.ProductFlat || mongoose.model('ProductFlat', ProductFlatSchema);

const CourierCartSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  items: Array
}, { strict: false });

const CourierCart = mongoose.models.CourierCart || mongoose.model('CourierCart', CourierCartSchema);

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB successfully!");

    const userId = '6a4900efea78373da07b4c7d'; // User ID from previous output
    const cart = await CourierCart.findOne({ userId }).lean();

    if (!cart) {
      console.log("No courier cart found for user.");
      return;
    }

    console.log("=== Cart Items ===");
    console.log(JSON.stringify(cart.items, null, 2));

    for (const item of cart.items) {
      const styleGroupId = item.productId.toString();
      console.log(`\nQuerying ProductFlat for styleGroupId: ${styleGroupId}, size: ${item.size}`);
      const siblings = await ProductFlat.find({ styleGroupId, size: item.size }).lean();
      console.log(`Found ${siblings.length} sibling(s)`);
      if (siblings.length > 0) {
        console.log("Sample sibling:", {
          _id: siblings[0]._id,
          name: siblings[0].name,
          size: siblings[0].size,
          color: siblings[0].color,
          price: siblings[0].price,
          stock: siblings[0].stock
        });
      }
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
