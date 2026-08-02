import mongoose from 'mongoose';
import Merchant from './src/models/merchant.model.js';

const uri = "mongodb+srv://shubhambiswas9899:Shubham%402000@ff.tixzrs2.mongodb.net/preproduction?retryWrites=true&w=majority&appName=FF";

async function run() {
  try {
    await mongoose.connect(uri);
    const merchants = await Merchant.find().select('shopName ownerName email');
    
    console.log("All Merchants:");
    merchants.forEach(m => {
        console.log(`- ID: ${m._id}, Shop: ${m.shopName}, Owner: ${m.ownerName}, Email: ${m.email}`);
    });
  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
