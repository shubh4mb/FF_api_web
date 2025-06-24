import mongoose from 'mongoose';  

// const MONGODB_URI = process.env.MONGODB_URI;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect("mongodb+srv://shubhambiswas9899:Shubham%402000@ff.tixzrs2.mongodb.net/?retryWrites=true&w=majority&appName=FF");

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;



  