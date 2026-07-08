import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Define a minimal Lead schema for the script
const leadSchema = new mongoose.Schema({}, { strict: false });
const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema);

const fixLocations = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await Lead.updateMany(
      { 'location.latitude': 9.9312, 'location.longitude': 76.2673 },
      { $unset: { location: "" } }
    );

    console.log(`Successfully fixed ${result.modifiedCount} leads by removing dummy location.`);
  } catch (error) {
    console.error('Error fixing locations:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

fixLocations();
