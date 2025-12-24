import mongoose from "mongoose";
import * as turf from "@turf/turf";
import Zone from "../src/models/zone.model.js";
import dotenv from 'dotenv';

dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not defined in environment variables");
  process.exit(1);
}

async function backfill() {
  try {
    const conn = await mongoose.connect(MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    const zones = await Zone.find({
      deliveryBoundary: { $exists: false },
    });

    console.log(`Found ${zones.length} zones to backfill`);

    for (const zone of zones) {
      try {
        const turfPolygon = turf.polygon(zone.boundary.coordinates);

        const buffered = turf.buffer(turfPolygon, 3, {
          units: "kilometers",
        });

        zone.deliveryBoundary = buffered.geometry;
        await zone.save();

        console.log(`✔ Updated zone: ${zone.zoneName}`);
      } catch (err) {
        console.error(`❌ Failed zone: ${zone.zoneName}`, err.message);
      }
    }

    console.log("✅ Backfill completed successfully");
  } catch (error) {
    console.error(`❌ Error during backfill: ${error.message}`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("✅ MongoDB connection closed");
  }
}

backfill().catch(console.error);
