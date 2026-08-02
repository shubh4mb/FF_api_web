import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const uri = process.env.MONGODB_URI;
console.log("URI:", uri ? "Found" : "Not Found");

async function checkDb() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    // 1. Get the merchant "shubhamhome@gmail.com"
    const merchant = await db.collection("merchants").findOne({ email: "shubhamhome@gmail.com" });
    console.log("Merchant:", merchant ? {
      _id: merchant._id,
      email: merchant.email,
      warehouseStatus: merchant.warehouseStatus,
      assignedWarehouseIds: merchant.assignedWarehouseIds,
      isVerified: merchant.isVerified
    } : "Not found");

    // 2. Get the warehouse operator (we don't know the email, so let's get all operators)
    const operators = await db.collection("merchants").find({ accountType: "warehouse" }).toArray();
    console.log("Operators:", operators.map(o => ({
      _id: o._id,
      email: o.email,
      warehouseId: o.warehouseId
    })));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDb();
